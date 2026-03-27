import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  JenisTransaksi,
  NasabahStatus,
  PinjamanStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { PinjamanRepository } from './pinjaman.repository';
import {
  AngsuranPinjamanDto,
  CreatePinjamanDto,
  PencairanPinjamanDto,
  VerifikasiPinjamanDto,
} from './dto';
import { TransaksiRepository } from '../transaksi/transaksi.repository';
import { TransaksiService } from '../transaksi/transaksi.service';
import { DEFAULT_PAGE_SIZE } from '../../common/constants/pagination.constants';
import { AuditTrailService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { SETTING_KEYS } from '../settings/constants/settings.constants';

@Injectable()
export class PinjamanService {
  constructor(
    private readonly pinjamanRepository: PinjamanRepository,
    private readonly transaksiRepository: TransaksiRepository,
    private readonly transaksiService: TransaksiService,
    private readonly auditTrailService: AuditTrailService,
    private readonly settingsService: SettingsService,
    private readonly prisma: PrismaClient,
  ) {}

  private toDecimal(value: number | Prisma.Decimal) {
    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  }

  async createPinjaman(
    dto: CreatePinjamanDto,
    userId: number,
    ipAddress?: string,
  ) {
    const [
      maxTenorMonths,
      minTenorMonths,
      maxLoanAmount,
      defaultInterestPercent,
      autoApprovalLimit,
    ] = await Promise.all([
      this.settingsService.getNumber(SETTING_KEYS.LOAN_MAX_TENOR_MONTHS),
      this.settingsService.getNumber(SETTING_KEYS.LOAN_MIN_TENOR_MONTHS),
      this.settingsService.getNumber(SETTING_KEYS.LOAN_MAX_LOAN_AMOUNT),
      this.settingsService.getNumber(
        SETTING_KEYS.LOAN_DEFAULT_INTEREST_PERCENT,
      ),
      this.settingsService.getNumber(SETTING_KEYS.LOAN_AUTO_APPROVAL_LIMIT),
    ]);

    if (dto.tenorBulan > maxTenorMonths) {
      throw new BadRequestException(
        `Tenor pinjaman melebihi batas maksimum ${maxTenorMonths} bulan`,
      );
    }

    if (dto.tenorBulan < minTenorMonths) {
      throw new BadRequestException(
        `Tenor pinjaman kurang dari batas minimum ${minTenorMonths} bulan`,
      );
    }

    if (dto.jumlahPinjaman > maxLoanAmount) {
      throw new BadRequestException(
        `Jumlah pinjaman melebihi batas maksimum ${maxLoanAmount}`,
      );
    }

    const bungaPersen = defaultInterestPercent;
    const isAutoApproved = dto.jumlahPinjaman <= autoApprovalLimit;

    const nasabah = await this.pinjamanRepository.findNasabahById(
      dto.nasabahId,
    );
    if (!nasabah) {
      throw new NotFoundException('Nasabah tidak ditemukan');
    }

    if (nasabah.status !== NasabahStatus.AKTIF) {
      throw new BadRequestException('Nasabah tidak aktif');
    }

    const pinjaman = await this.prisma.$transaction(async (tx) => {
      const created = await this.pinjamanRepository.createPinjaman(
        {
          nasabahId: dto.nasabahId,
          jumlahPinjaman: dto.jumlahPinjaman,
          bungaPersen,
          tenorBulan: dto.tenorBulan,
          sisaPinjaman: 0,
          status: isAutoApproved
            ? PinjamanStatus.DISETUJUI
            : PinjamanStatus.PENDING,
          tanggalPersetujuan: isAutoApproved ? new Date() : null,
        },
        tx,
      );

      await this.auditTrailService.log(
        {
          action: AuditAction.CREATE,
          entityName: 'Pinjaman',
          entityId: created.id,
          userId,
          after: {
            nasabahId: created.nasabahId,
            jumlahPinjaman: Number(created.jumlahPinjaman),
            bungaPersen: Number(created.bungaPersen),
            tenorBulan: created.tenorBulan,
            status: created.status,
          },
          ipAddress,
        },
        tx,
      );

      return created;
    });

    return {
      message: 'Pengajuan pinjaman berhasil dibuat',
      data: pinjaman,
    };
  }

  async listPinjamanByNasabah(nasabahId: number, cursor?: number) {
    const { data, nextCursor } =
      await this.pinjamanRepository.listPinjamanByNasabah({
        nasabahId,
        cursor,
        take: DEFAULT_PAGE_SIZE,
      });

    return {
      message: 'Berhasil mengambil data pinjaman nasabah',
      data,
      pagination: {
        nextCursor,
        limit: DEFAULT_PAGE_SIZE,
        hasNext: nextCursor !== null,
      },
    };
  }

  async verifikasiPinjaman(
    id: number,
    dto: VerifikasiPinjamanDto,
    userId: number,
    ipAddress?: string,
  ) {
    const pinjaman = await this.pinjamanRepository.findPinjamanById(id);
    if (!pinjaman) {
      throw new NotFoundException('Pinjaman tidak ditemukan');
    }

    if (pinjaman.status !== PinjamanStatus.PENDING) {
      throw new BadRequestException('Pinjaman sudah diverifikasi');
    }

    if (
      dto.status !== PinjamanStatus.DISETUJUI &&
      dto.status !== PinjamanStatus.DITOLAK
    ) {
      throw new BadRequestException('Status verifikasi tidak valid');
    }

    const pegawai = await this.pinjamanRepository.findPegawaiByUserId(userId);
    if (!pegawai) {
      throw new NotFoundException('Pegawai tidak ditemukan');
    }

    if (!pegawai.statusAktif) {
      throw new BadRequestException('Pegawai tidak aktif');
    }

    const auditAction =
      dto.status === PinjamanStatus.DISETUJUI
        ? AuditAction.APPROVE
        : AuditAction.REJECT;
    const approvedAt = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await this.pinjamanRepository.updatePinjamanStatus(
        {
          id,
          status: dto.status,
          verifiedById: pegawai.id,
          tanggalPersetujuan: approvedAt,
        },
        tx,
      );

      await this.auditTrailService.log(
        {
          action: auditAction,
          entityName: 'Pinjaman',
          entityId: id,
          userId,
          before: {
            status: pinjaman.status,
            verifiedById: pinjaman.verifiedById ?? null,
            tanggalPersetujuan:
              pinjaman.tanggalPersetujuan?.toISOString() ?? null,
          },
          after: {
            status: result.status,
            verifiedById: result.verifiedById ?? null,
            tanggalPersetujuan:
              result.tanggalPersetujuan?.toISOString() ?? null,
          },
          ipAddress,
        },
        tx,
      );

      return result;
    });

    return {
      message: 'Verifikasi pinjaman berhasil',
      data: updated,
    };
  }

  async pencairanPinjaman(
    id: number,
    dto: PencairanPinjamanDto,
    userId: number,
  ) {
    const pinjaman = await this.pinjamanRepository.findPinjamanById(id);
    if (!pinjaman) {
      throw new NotFoundException('Pinjaman tidak ditemukan');
    }

    if (pinjaman.status !== PinjamanStatus.DISETUJUI) {
      throw new BadRequestException('Pinjaman belum disetujui');
    }

    if (this.toDecimal(pinjaman.sisaPinjaman).greaterThan(this.toDecimal(0))) {
      throw new BadRequestException('Pencairan pinjaman sudah dibuat');
    }

    const pencairanAgg =
      await this.pinjamanRepository.findPencairanTransaksi(id);
    const totalPencairan = pencairanAgg._sum.nominal ?? this.toDecimal(0);

    const pegawai = await this.pinjamanRepository.findPegawaiByUserId(userId);
    if (!pegawai) {
      throw new NotFoundException('Pegawai tidak ditemukan');
    }

    if (!pegawai.statusAktif) {
      throw new BadRequestException('Pegawai tidak aktif');
    }

    const jumlahPinjaman = this.toDecimal(pinjaman.jumlahPinjaman);
    if (totalPencairan.greaterThan(this.toDecimal(0))) {
      throw new BadRequestException('Pencairan pinjaman sudah dibuat');
    }

    const nominal = dto.nominal ?? jumlahPinjaman.toNumber();
    const nominalDecimal = this.toDecimal(nominal);
    if (nominalDecimal.lessThanOrEqualTo(this.toDecimal(0))) {
      throw new BadRequestException('Nominal pencairan tidak valid');
    }
    if (!nominalDecimal.equals(jumlahPinjaman)) {
      throw new BadRequestException('Pencairan anda tidak sesuai');
    }

    return this.transaksiService.createTransaksi(
      {
        nasabahId: pinjaman.nasabahId,
        pinjamanId: pinjaman.id,
        jenisTransaksi: JenisTransaksi.PENCAIRAN,
        nominal,
        tanggal: dto.tanggal,
        metodePembayaran: dto.metodePembayaran,
        catatan: dto.catatan,
      },
      userId,
    );
  }

  async angsuranPinjaman(id: number, dto: AngsuranPinjamanDto, userId: number) {
    const pinjaman = await this.pinjamanRepository.findPinjamanById(id);
    if (!pinjaman) {
      throw new NotFoundException('Pinjaman tidak ditemukan');
    }

    if (pinjaman.status !== PinjamanStatus.DISETUJUI) {
      throw new BadRequestException('Pinjaman belum disetujui');
    }

    if (pinjaman.sisaPinjaman.lessThanOrEqualTo(this.toDecimal(0))) {
      throw new BadRequestException('Pinjaman sudah lunas');
    }

    if (pinjaman.sisaPinjaman.lessThan(this.toDecimal(dto.nominal))) {
      throw new BadRequestException('Nominal melebihi sisa pinjaman');
    }

    const pegawai = await this.pinjamanRepository.findPegawaiByUserId(userId);
    if (!pegawai) {
      throw new NotFoundException('Pegawai tidak ditemukan');
    }

    if (!pegawai.statusAktif) {
      throw new BadRequestException('Pegawai tidak aktif');
    }

    return this.transaksiService.createTransaksi(
      {
        nasabahId: pinjaman.nasabahId,
        pinjamanId: pinjaman.id,
        jenisTransaksi: JenisTransaksi.ANGSURAN,
        nominal: dto.nominal,
        tanggal: dto.tanggal,
        metodePembayaran: dto.metodePembayaran,
        catatan: dto.catatan,
      },
      userId,
    );
  }

  async listTransaksiByPinjaman(pinjamanId: number, cursor?: number) {
    const pinjaman = await this.pinjamanRepository.findPinjamanById(pinjamanId);
    if (!pinjaman) {
      throw new NotFoundException('Pinjaman tidak ditemukan');
    }

    const { data, nextCursor } =
      await this.transaksiRepository.listTransaksiByPinjaman({
        pinjamanId,
        cursor,
        take: DEFAULT_PAGE_SIZE,
      });

    return {
      message: 'Berhasil mengambil histori transaksi pinjaman',
      data,
      pagination: {
        nextCursor,
        limit: DEFAULT_PAGE_SIZE,
        hasNext: nextCursor !== null,
      },
    };
  }

  async softDeletePinjaman(id: number) {
    const pinjaman = await this.pinjamanRepository.findPinjamanById(id);
    if (!pinjaman) {
      throw new NotFoundException('Pinjaman tidak ditemukan');
    }

    await this.pinjamanRepository.softDeletePinjaman(id);

    return {
      message: 'Pinjaman berhasil dihapus',
    };
  }
}
