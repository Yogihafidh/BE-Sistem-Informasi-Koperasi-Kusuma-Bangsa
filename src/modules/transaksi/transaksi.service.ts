import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  JenisTransaksi,
  NasabahStatus,
  PinjamanStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { TransaksiRepository } from './transaksi.repository';
import { CreateTransaksiDto } from './dto';
import { DEFAULT_PAGE_SIZE } from '../../common/constants/pagination.constants';
import { validateBidirectionalPaginationParams } from '../../common/utils/pagination.util';
import { SettingsService } from '../settings/settings.service';
import { SETTING_KEYS } from '../settings/constants/settings.constants';
import { DashboardService } from '../dashboard/dashboard.service';

@Injectable()
export class TransaksiService {
  constructor(
    private readonly transaksiRepository: TransaksiRepository,
    private readonly settingsService: SettingsService,
    private readonly dashboardService: DashboardService,
    private readonly prisma: PrismaClient,
  ) {}

  private toDecimal(value: number) {
    return new Prisma.Decimal(value);
  }

  async createTransaksi(dto: CreateTransaksiDto, userId: number) {
    const maxDailyNominal = await this.settingsService.getNumber(
      SETTING_KEYS.TRANSACTION_MAX_DAILY_NOMINAL,
    );

    const pegawai = await this.transaksiRepository.findPegawaiByUserId(userId);
    if (!pegawai) {
      throw new NotFoundException('Pegawai tidak ditemukan');
    }

    if (!pegawai.statusAktif) {
      throw new BadRequestException('Pegawai tidak aktif');
    }

    const nasabah = await this.transaksiRepository.findNasabahById(
      dto.nasabahId,
    );
    if (!nasabah) {
      throw new NotFoundException('Nasabah tidak ditemukan');
    }

    if (nasabah.status !== NasabahStatus.AKTIF) {
      throw new BadRequestException('Nasabah tidak aktif');
    }

    const requiresRekening =
      dto.jenisTransaksi === JenisTransaksi.SETORAN ||
      dto.jenisTransaksi === JenisTransaksi.PENARIKAN;
    const requiresPinjaman =
      dto.jenisTransaksi === JenisTransaksi.PENCAIRAN ||
      dto.jenisTransaksi === JenisTransaksi.ANGSURAN;

    if (requiresRekening && !dto.rekeningSimpananId) {
      throw new BadRequestException('Rekening simpanan wajib diisi');
    }

    if (requiresPinjaman && !dto.pinjamanId) {
      throw new BadRequestException('Pinjaman wajib diisi');
    }

    if (dto.rekeningSimpananId && dto.pinjamanId) {
      throw new BadRequestException(
        'Rekening simpanan dan pinjaman tidak boleh bersamaan',
      );
    }

    const nominal = this.toDecimal(dto.nominal);
    const rekening = requiresRekening
      ? await this.transaksiRepository.findRekeningSimpananById(
          dto.rekeningSimpananId as number,
          dto.nasabahId,
        )
      : null;
    if (requiresRekening && !rekening) {
      throw new NotFoundException('Rekening simpanan tidak ditemukan');
    }

    const pinjaman = requiresPinjaman
      ? await this.transaksiRepository.findPinjamanById(
          dto.pinjamanId as number,
          dto.nasabahId,
        )
      : null;
    if (requiresPinjaman && !pinjaman) {
      throw new NotFoundException('Pinjaman tidak ditemukan');
    }

    let updateRekening:
      | {
          id: number;
          saldoBerjalan: Prisma.Decimal;
        }
      | undefined;
    if (rekening) {
      const saldoBerjalan = rekening.saldoBerjalan;
      const saldoBaru =
        dto.jenisTransaksi === JenisTransaksi.SETORAN
          ? saldoBerjalan.plus(nominal)
          : (() => {
              if (saldoBerjalan.lessThan(nominal)) {
                throw new BadRequestException('Saldo simpanan tidak mencukupi');
              }
              return saldoBerjalan.minus(nominal);
            })();

      updateRekening = {
        id: rekening.id,
        saldoBerjalan: saldoBaru,
      };
    }

    let updatePinjaman:
      | {
          id: number;
          sisaPinjaman: Prisma.Decimal;
          status?: PinjamanStatus;
        }
      | undefined;
    if (pinjaman) {
      if (pinjaman.status !== PinjamanStatus.DISETUJUI) {
        throw new BadRequestException('Pinjaman belum disetujui');
      }

      let sisaBaru = pinjaman.sisaPinjaman;
      let statusPinjaman: PinjamanStatus | undefined;

      if (dto.jenisTransaksi === JenisTransaksi.PENCAIRAN) {
        if (pinjaman.sisaPinjaman.greaterThan(this.toDecimal(0))) {
          throw new BadRequestException('Pencairan pinjaman sudah dibuat');
        }
        if (!nominal.equals(pinjaman.jumlahPinjaman)) {
          throw new BadRequestException('Pencairan anda tidak sesuai');
        }
        sisaBaru = pinjaman.jumlahPinjaman;
      } else {
        if (pinjaman.sisaPinjaman.lessThan(nominal)) {
          throw new BadRequestException('Nominal melebihi sisa pinjaman');
        }
        sisaBaru = pinjaman.sisaPinjaman.minus(nominal);
        if (sisaBaru.lessThanOrEqualTo(this.toDecimal(0))) {
          statusPinjaman = PinjamanStatus.LUNAS;
        }
      }

      updatePinjaman = {
        id: pinjaman.id,
        sisaPinjaman: sisaBaru,
        status: statusPinjaman,
      };
    }

    const tanggal = dto.tanggal ? new Date(dto.tanggal) : new Date();

    const tanggalFrom = new Date(
      tanggal.getFullYear(),
      tanggal.getMonth(),
      tanggal.getDate(),
      0,
      0,
      0,
      0,
    );
    const tanggalTo = new Date(
      tanggal.getFullYear(),
      tanggal.getMonth(),
      tanggal.getDate(),
      23,
      59,
      59,
      999,
    );

    const dailyAgg =
      await this.transaksiRepository.sumNominalByNasabahPerTanggal({
        nasabahId: dto.nasabahId,
        tanggalFrom,
        tanggalTo,
      });
    const totalToday = Number(dailyAgg._sum.nominal ?? 0);
    if (totalToday + dto.nominal > maxDailyNominal) {
      throw new BadRequestException(
        `Total transaksi harian melebihi batas maksimum ${maxDailyNominal}`,
      );
    }

    const transaksi = await this.prisma.$transaction(async (tx) => {
      if (updateRekening) {
        await tx.rekeningSimpanan.update({
          where: { id: updateRekening.id },
          data: { saldoBerjalan: updateRekening.saldoBerjalan },
        });
      }

      if (updatePinjaman) {
        await tx.pinjaman.update({
          where: { id: updatePinjaman.id },
          data: {
            sisaPinjaman: updatePinjaman.sisaPinjaman,
            ...(updatePinjaman.status ? { status: updatePinjaman.status } : {}),
          },
        });
      }

      return tx.transaksi.create({
        data: {
          nasabahId: dto.nasabahId,
          pegawaiId: pegawai.id,
          rekeningSimpananId: dto.rekeningSimpananId,
          pinjamanId: dto.pinjamanId,
          jenisTransaksi: dto.jenisTransaksi,
          nominal: dto.nominal,
          tanggal,
          metodePembayaran: dto.metodePembayaran,
          catatan: dto.catatan,
        },
        select: {
          id: true,
          nasabahId: true,
          pegawaiId: true,
          rekeningSimpananId: true,
          pinjamanId: true,
          jenisTransaksi: true,
          nominal: true,
          tanggal: true,
          metodePembayaran: true,
          catatan: true,
          createdAt: true,
          deletedAt: true,
        },
      });
    });

    await this.dashboardService.invalidateDashboardBecauseFinancialChanged(
      'transaksi:create',
    );

    return {
      message: 'Transaksi berhasil diproses',
      data: transaksi,
    };
  }

  async getTransaksiById(id: number) {
    const transaksi =
      await this.transaksiRepository.findTransaksiSummaryById(id);
    if (!transaksi) {
      throw new NotFoundException('Transaksi tidak ditemukan');
    }

    return {
      message: 'Berhasil mengambil detail transaksi',
      data: transaksi,
    };
  }

  async softDeleteTransaksi(id: number) {
    const transaksi =
      await this.transaksiRepository.findTransaksiSummaryById(id);
    if (!transaksi) {
      throw new NotFoundException('Transaksi tidak ditemukan');
    }

    await this.transaksiRepository.softDeleteTransaksi(id);
    await this.dashboardService.invalidateDashboardBecauseFinancialChanged(
      'transaksi:softDelete',
    );

    return {
      message: 'Transaksi berhasil dihapus',
    };
  }

  async listTransaksi(args: {
    after?: number;
    before?: number;
    jenisTransaksi?: JenisTransaksi;
    tanggalFrom?: string;
    tanggalTo?: string;
  }) {
    validateBidirectionalPaginationParams(args.after, args.before);

    const tanggalFrom = args.tanggalFrom
      ? new Date(args.tanggalFrom)
      : undefined;
    const tanggalTo = args.tanggalTo ? new Date(args.tanggalTo) : undefined;

    const { data, nextCursor, prevCursor, hasNext, hasPrev } =
      await this.transaksiRepository.listTransaksi({
        page: {
          after: args.after,
          before: args.before,
          take: DEFAULT_PAGE_SIZE,
        },
        jenisTransaksi: args.jenisTransaksi,
        tanggalFrom,
        tanggalTo,
      });

    return {
      message: 'Berhasil mengambil data transaksi',
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

  async listTransaksiByNasabah(
    nasabahId: number,
    args: { after?: number; before?: number },
  ) {
    validateBidirectionalPaginationParams(args.after, args.before);

    const { data, nextCursor, prevCursor, hasNext, hasPrev } =
      await this.transaksiRepository.listTransaksiByNasabah({
        nasabahId,
        page: {
          after: args.after,
          before: args.before,
          take: DEFAULT_PAGE_SIZE,
        },
      });

    return {
      message: 'Berhasil mengambil data transaksi nasabah',
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

  async listTransaksiByPegawai(
    pegawaiId: number,
    args: { after?: number; before?: number },
  ) {
    validateBidirectionalPaginationParams(args.after, args.before);

    const { data, nextCursor, prevCursor, hasNext, hasPrev } =
      await this.transaksiRepository.listTransaksiByPegawai({
        pegawaiId,
        page: {
          after: args.after,
          before: args.before,
          take: DEFAULT_PAGE_SIZE,
        },
      });

    return {
      message: 'Berhasil mengambil data transaksi pegawai',
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

  async listTransaksiByRekening(
    rekeningSimpananId: number,
    args: { after?: number; before?: number },
  ) {
    validateBidirectionalPaginationParams(args.after, args.before);

    const { data, nextCursor, prevCursor, hasNext, hasPrev } =
      await this.transaksiRepository.listTransaksiByRekening({
        rekeningSimpananId,
        page: {
          after: args.after,
          before: args.before,
          take: DEFAULT_PAGE_SIZE,
        },
      });

    return {
      message: 'Berhasil mengambil data transaksi rekening simpanan',
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

  async listTransaksiByPinjaman(
    pinjamanId: number,
    args: { after?: number; before?: number },
  ) {
    const pinjaman =
      await this.transaksiRepository.findPinjamanByIdOnly(pinjamanId);

    if (!pinjaman) {
      throw new NotFoundException('Pinjaman tidak ditemukan');
    }

    validateBidirectionalPaginationParams(args.after, args.before);

    const { data, nextCursor, prevCursor, hasNext, hasPrev } =
      await this.transaksiRepository.listTransaksiByPinjaman({
        pinjamanId,
        page: {
          after: args.after,
          before: args.before,
          take: DEFAULT_PAGE_SIZE,
        },
      });

    return {
      message: 'Berhasil mengambil data transaksi pinjaman',
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
}
