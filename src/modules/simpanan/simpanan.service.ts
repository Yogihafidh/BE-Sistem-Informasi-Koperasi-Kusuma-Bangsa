import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
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
import { SettingsService } from '../settings/settings.service';
import { SETTING_KEYS } from '../settings/constants/settings.constants';

@Injectable()
export class SimpananService {
  constructor(
    private readonly simpananRepository: SimpananRepository,
    private readonly transaksiRepository: TransaksiRepository,
    private readonly transaksiService: TransaksiService,
    private readonly settingsService: SettingsService,
    private readonly prisma: PrismaClient,
  ) {}

  async listRekeningByNasabah(nasabahId: number) {
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
    const [minInitialDeposit, minMonthlyDeposit] = await Promise.all([
      this.settingsService.getNumber(SETTING_KEYS.SAVINGS_MIN_INITIAL_DEPOSIT),
      this.settingsService.getNumber(SETTING_KEYS.SAVINGS_MIN_MONTHLY_DEPOSIT),
    ]);

    const pegawai = await this.simpananRepository.findPegawaiByUserId(userId);
    if (!pegawai) {
      throw new NotFoundException('Pegawai tidak ditemukan');
    }

    if (!pegawai.statusAktif) {
      throw new BadRequestException('Pegawai tidak aktif');
    }

    const rekening = await this.simpananRepository.findRekeningById(rekeningId);
    if (!rekening) {
      throw new NotFoundException('Rekening simpanan tidak ditemukan');
    }

    if (rekening.nasabah.status !== NasabahStatus.AKTIF) {
      throw new BadRequestException('Nasabah tidak aktif');
    }

    const isInitialDeposit = rekening.saldoBerjalan.lessThanOrEqualTo(0);
    if (isInitialDeposit && dto.nominal < minInitialDeposit) {
      throw new BadRequestException(
        `Setoran awal minimum adalah ${minInitialDeposit}`,
      );
    }

    const isMandatoryMonthlyDeposit =
      rekening.jenisSimpanan === JenisSimpanan.WAJIB && !isInitialDeposit;
    if (isMandatoryMonthlyDeposit && dto.nominal < minMonthlyDeposit) {
      throw new BadRequestException(
        `Setoran bulanan minimum adalah ${minMonthlyDeposit}`,
      );
    }

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
    const allowWithdrawalIfLoanActive = await this.settingsService.getBoolean(
      SETTING_KEYS.SAVINGS_ALLOW_WITHDRAWAL_IF_LOAN_ACTIVE,
    );

    const pegawai = await this.simpananRepository.findPegawaiByUserId(userId);
    if (!pegawai) {
      throw new NotFoundException('Pegawai tidak ditemukan');
    }

    if (!pegawai.statusAktif) {
      throw new BadRequestException('Pegawai tidak aktif');
    }

    const rekening = await this.simpananRepository.findRekeningById(rekeningId);
    if (!rekening) {
      throw new NotFoundException('Rekening simpanan tidak ditemukan');
    }

    if (rekening.nasabah.status !== NasabahStatus.AKTIF) {
      throw new BadRequestException('Nasabah tidak aktif');
    }

    if (!allowWithdrawalIfLoanActive) {
      const activeLoans = await this.prisma.pinjaman.count({
        where: {
          nasabahId: rekening.nasabahId,
          deletedAt: null,
          status: PinjamanStatus.DISETUJUI,
          sisaPinjaman: { gt: new Prisma.Decimal(0) },
        },
      });
      if (activeLoans > 0) {
        throw new BadRequestException(
          'Penarikan tidak diizinkan karena nasabah masih memiliki pinjaman aktif',
        );
      }
    }

    if (rekening.saldoBerjalan.lessThan(dto.nominal)) {
      throw new BadRequestException('Saldo simpanan tidak mencukupi');
    }

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

  async listTransaksiByRekening(rekeningId: number, cursor?: number) {
    const rekening = await this.simpananRepository.findRekeningById(rekeningId);
    if (!rekening) {
      throw new NotFoundException('Rekening simpanan tidak ditemukan');
    }

    const { data, nextCursor } =
      await this.transaksiRepository.listTransaksiByRekening({
        rekeningSimpananId: rekeningId,
        cursor,
        take: DEFAULT_PAGE_SIZE,
      });

    return {
      message: 'Berhasil mengambil histori transaksi simpanan',
      data,
      pagination: {
        nextCursor,
        limit: DEFAULT_PAGE_SIZE,
        hasNext: nextCursor !== null,
      },
    };
  }

  async softDeleteRekening(id: number) {
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

    return {
      message: 'Rekening simpanan berhasil dihapus',
    };
  }
}
