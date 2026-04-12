import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  JenisSimpanan,
  JenisTransaksi,
  NasabahStatus,
  PinjamanStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { SimpananRepository } from './simpanan.repository';
import { SimpananTransaksiDto } from './dto';
import { TransaksiRepository } from '../transaksi/transaksi.repository';
import { TransaksiService } from '../transaksi/transaksi.service';
import { DEFAULT_PAGE_SIZE } from '../../common/constants/pagination.constants';
import { validateBidirectionalPaginationParams } from '../../common/utils/pagination.util';
import { SettingsService } from '../settings/settings.service';
import { SETTING_KEYS } from '../settings/constants/settings.constants';
import { AuditTrailService } from '../audit/audit.service';

@Injectable()
export class SimpananService {
  private static readonly MAX_DB_INT = 2147483647;

  constructor(
    private readonly simpananRepository: SimpananRepository,
    private readonly transaksiRepository: TransaksiRepository,
    private readonly transaksiService: TransaksiService,
    private readonly settingsService: SettingsService,
    private readonly auditTrailService: AuditTrailService,
    private readonly prisma: PrismaClient,
  ) {}

  async listRekeningByNasabah(nasabahId: number) {
    this.ensureValidDbIntId(nasabahId, 'Nasabah');

    const nasabah = await this.simpananRepository.findNasabahById(nasabahId);
    if (!nasabah) {
      throw new NotFoundException('Nasabah tidak ditemukan');
    }

    const data = await this.simpananRepository.listRekeningByNasabah(nasabahId);
    return {
      message: 'Berhasil mengambil rekening simpanan nasabah',
      data,
    };
  }

  async setoranSimpanan(
    rekeningId: number,
    dto: SimpananTransaksiDto,
    userId: number,
  ) {
    this.ensureValidDbIntId(rekeningId, 'Rekening simpanan');

    // 1. Mengambil konfigurasi dari modul Settings
    const [minInitialDeposit, minMonthlyDeposit] = await Promise.all([
      this.settingsService.getNumber(SETTING_KEYS.SAVINGS_MIN_INITIAL_DEPOSIT),
      this.settingsService.getNumber(SETTING_KEYS.SAVINGS_MIN_MONTHLY_DEPOSIT),
    ]);

    // 2. Validasi pegawai
    const pegawai = await this.simpananRepository.findPegawaiByUserId(userId);
    if (!pegawai) {
      throw new NotFoundException('Pegawai tidak ditemukan');
    }

    if (!pegawai.statusAktif) {
      throw new BadRequestException('Pegawai tidak aktif');
    }

    // 3. Validasi rekening simpanan
    const rekening = await this.simpananRepository.findRekeningById(rekeningId);
    if (!rekening) {
      throw new NotFoundException('Rekening simpanan tidak ditemukan');
    }

    if (rekening.nasabah.status !== NasabahStatus.AKTIF) {
      throw new BadRequestException('Nasabah tidak aktif');
    }

    await this.validateSetoranRules({
      rekening,
      rekeningId,
      nominal: dto.nominal,
      tanggal: dto.tanggal,
      fixedPokokNominal: minInitialDeposit,
      fixedWajibNominal: minMonthlyDeposit,
    });

    return this.transaksiService.createTransaksi(
      {
        nasabahId: rekening.nasabahId,
        rekeningSimpananId: rekening.id,
        jenisTransaksi: JenisTransaksi.SETORAN,
        nominal: dto.nominal,
        tanggal: dto.tanggal,
        metodePembayaran: dto.metodePembayaran,
        catatan: dto.catatan,
      },
      userId,
    );
  }

  async penarikanSimpanan(
    rekeningId: number,
    dto: SimpananTransaksiDto,
    userId: number,
  ) {
    this.ensureValidDbIntId(rekeningId, 'Rekening simpanan');

    // 1. Mengambil konfigurasi dari modul Settings
    const allowWithdrawalIfLoanActive = await this.settingsService.getBoolean(
      SETTING_KEYS.SAVINGS_ALLOW_WITHDRAWAL_IF_LOAN_ACTIVE,
    );

    // 2. Validasi pegawai
    const pegawai = await this.simpananRepository.findPegawaiByUserId(userId);
    if (!pegawai) {
      throw new NotFoundException('Pegawai tidak ditemukan');
    }

    if (!pegawai.statusAktif) {
      throw new BadRequestException('Pegawai tidak aktif');
    }

    // 3. Validasi rekening simpanan
    const rekening = await this.simpananRepository.findRekeningById(rekeningId);
    if (!rekening) {
      throw new NotFoundException('Rekening simpanan tidak ditemukan');
    }

    // 4. Validasi status nasabah dan jenis simpanan saat penarikan
    const isNasabahAktif = rekening.nasabah.status === NasabahStatus.AKTIF;
    const isNasabahNonAktif =
      rekening.nasabah.status === NasabahStatus.NONAKTIF;

    if (
      rekening.jenisSimpanan === JenisSimpanan.POKOK ||
      rekening.jenisSimpanan === JenisSimpanan.WAJIB
    ) {
      if (isNasabahAktif) {
        throw new BadRequestException(
          'Simpanan pokok dan wajib hanya dapat ditarik saat anggota keluar',
        );
      }

      if (!isNasabahNonAktif) {
        throw new BadRequestException(
          'Penarikan simpanan hanya dapat diproses untuk status nasabah yang valid',
        );
      }
    } else if (!isNasabahAktif && !isNasabahNonAktif) {
      throw new BadRequestException(
        'Penarikan simpanan hanya dapat diproses untuk status nasabah yang valid',
      );
    }

    // 5. Validasi penarikan tidak diizinkan jika nasabah memiliki pinjaman aktif (jika setting tidak mengizinkan)
    if (!allowWithdrawalIfLoanActive) {
      // Cek apakah nasabah memiliki pinjaman aktif dengan sisa pinjaman > 0
      const activeLoans = await this.prisma.pinjaman.count({
        where: {
          nasabahId: rekening.nasabahId,
          deletedAt: null,
          status: {
            in: [PinjamanStatus.DISETUJUI, PinjamanStatus.TERLAMBAT],
          },
          sisaPinjaman: { gt: new Prisma.Decimal(0) },
        },
      });

      // Jika ada pinjaman aktif, larang penarikan
      if (activeLoans > 0) {
        throw new BadRequestException(
          'Penarikan tidak diizinkan karena nasabah masih memiliki pinjaman aktif',
        );
      }
    }

    // 6. Validasi saldo mencukupi untuk penarikan
    if (rekening.saldoBerjalan.lessThan(dto.nominal)) {
      throw new BadRequestException('Saldo simpanan tidak mencukupi');
    }

    // 7. Proses penarikan dengan membuat transaksi penarikan
    return this.transaksiService.createTransaksi(
      {
        nasabahId: rekening.nasabahId,
        rekeningSimpananId: rekening.id,
        jenisTransaksi: JenisTransaksi.PENARIKAN,
        nominal: dto.nominal,
        tanggal: dto.tanggal,
        metodePembayaran: dto.metodePembayaran,
        catatan: dto.catatan,
      },
      userId,
    );
  }

  async listTransaksiByRekening(
    rekeningId: number,
    args: { after?: number; before?: number },
  ) {
    this.ensureValidDbIntId(rekeningId, 'Rekening simpanan');

    validateBidirectionalPaginationParams(args.after, args.before);

    const rekening = await this.simpananRepository.findRekeningById(rekeningId);
    if (!rekening) {
      throw new NotFoundException('Rekening simpanan tidak ditemukan');
    }

    const { data, nextCursor, prevCursor, hasNext, hasPrev } =
      await this.transaksiRepository.listTransaksiByRekening({
        rekeningSimpananId: rekeningId,
        page: {
          after: args.after,
          before: args.before,
          take: DEFAULT_PAGE_SIZE,
        },
      });

    return {
      message: 'Berhasil mengambil histori transaksi simpanan',
      data,
      pagination: {
        nextCursor,
        prevCursor,
        limit: DEFAULT_PAGE_SIZE,
        hasNext,
        hasPrev,
      },
    };
  }

  async softDeleteRekening(id: number, userId: number) {
    this.ensureValidDbIntId(id, 'Rekening simpanan');

    const rekening = await this.simpananRepository.findRekeningById(id);
    if (!rekening) {
      throw new NotFoundException('Rekening simpanan tidak ditemukan');
    }

    if (rekening.saldoBerjalan.greaterThan(new Prisma.Decimal(0))) {
      throw new BadRequestException(
        'Rekening dengan saldo masih ada tidak dapat dihapus',
      );
    }

    await this.simpananRepository.softDeleteRekening(id);
    await this.auditTrailService.log({
      action: 'DELETE' as AuditAction,
      userId,
      entityName: 'simpanan',
      entityId: rekening.id,
      before: {
        id: rekening.id,
        nasabahId: rekening.nasabahId,
        jenisSimpanan: rekening.jenisSimpanan,
        saldoBerjalan: Number(rekening.saldoBerjalan),
        deletedAt: rekening.deletedAt?.toISOString() ?? null,
      },
      after: {
        deletedAt: new Date().toISOString(),
      },
    });
    return {
      message: 'Rekening simpanan berhasil dihapus',
    };
  }

  private ensureValidDbIntId(id: number, entity: string) {
    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      id > SimpananService.MAX_DB_INT
    ) {
      throw new BadRequestException(`ID ${entity.toLowerCase()} tidak valid`);
    }
  }

  private async validateSetoranRules(args: {
    rekening: {
      id: number;
      jenisSimpanan: JenisSimpanan;
      saldoBerjalan: Prisma.Decimal;
    };
    rekeningId: number;
    nominal: number;
    tanggal?: string;
    fixedPokokNominal: number;
    fixedWajibNominal: number;
  }) {
    if (args.rekening.jenisSimpanan === JenisSimpanan.POKOK) {
      if (!args.rekening.saldoBerjalan.lessThanOrEqualTo(0)) {
        throw new BadRequestException(
          'Simpanan pokok hanya dapat dibayar satu kali saat awal keanggotaan',
        );
      }

      if (args.nominal !== args.fixedPokokNominal) {
        throw new BadRequestException(
          `Nominal simpanan pokok harus tepat ${args.fixedPokokNominal}`,
        );
      }
      return;
    }

    if (args.rekening.jenisSimpanan !== JenisSimpanan.WAJIB) {
      return;
    }

    if (args.nominal !== args.fixedWajibNominal) {
      throw new BadRequestException(
        `Nominal simpanan wajib harus tepat ${args.fixedWajibNominal} per bulan`,
      );
    }

    const transaksiDate = args.tanggal ? new Date(args.tanggal) : new Date();
    const { monthStart, monthEnd } = this.getUtcMonthRange(transaksiDate);

    const monthlySetoranCount =
      await this.simpananRepository.countSetoranByRekeningInRange({
        rekeningId: args.rekeningId,
        tanggalFrom: monthStart,
        tanggalTo: monthEnd,
      });

    if (monthlySetoranCount > 0) {
      throw new BadRequestException(
        'Simpanan wajib bulan ini sudah dibayarkan',
      );
    }
  }

  private getUtcMonthRange(date: Date) {
    return {
      monthStart: new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0),
      ),
      monthEnd: new Date(
        Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        ),
      ),
    };
  }
}
