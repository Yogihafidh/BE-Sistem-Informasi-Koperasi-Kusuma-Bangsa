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
import { TransaksiRepository } from './transaksi.repository';
import { CreateTransaksiDto } from './dto';
import { DEFAULT_PAGE_SIZE } from '../../common/constants/pagination.constants';
import { validateBidirectionalPaginationParams } from '../../common/utils/pagination.util';
import { SettingsService } from '../settings/settings.service';
import { SETTING_KEYS } from '../settings/constants/settings.constants';
import { AuditTrailService } from '../audit/audit.service';

@Injectable()
export class TransaksiService {
  constructor(
    private readonly transaksiRepository: TransaksiRepository,
    private readonly settingsService: SettingsService,
    private readonly auditTrailService: AuditTrailService,
    private readonly prisma: PrismaClient,
  ) {}

  private toDecimal(value: number) {
    return new Prisma.Decimal(value);
  }

  async createTransaksi(dto: CreateTransaksiDto, userId: number) {
    // 1. Mendapatkan konfigurasi dari modul Settings
    const maxDailyNominal = await this.settingsService.getNumber(
      SETTING_KEYS.TRANSACTION_MAX_DAILY_NOMINAL,
    );

    // 2. Validasi pegawai
    const pegawai = await this.transaksiRepository.findPegawaiByUserId(userId);
    if (!pegawai) {
      throw new NotFoundException('Pegawai tidak ditemukan');
    }

    if (!pegawai.statusAktif) {
      throw new BadRequestException('Pegawai tidak aktif');
    }

    // 3. Validasi nasabah
    const nasabah = await this.transaksiRepository.findNasabahById(
      dto.nasabahId,
    );

    if (!nasabah) {
      throw new NotFoundException('Nasabah tidak ditemukan');
    }

    if (nasabah.status !== NasabahStatus.AKTIF) {
      throw new BadRequestException('Nasabah tidak aktif');
    }

    // 4. Menentukan apakah transaksi butuh rekening atau pinjaman
    const requiresRekening =
      dto.jenisTransaksi === JenisTransaksi.SETORAN ||
      dto.jenisTransaksi === JenisTransaksi.PENARIKAN;
    const requiresPinjaman =
      dto.jenisTransaksi === JenisTransaksi.PENCAIRAN ||
      dto.jenisTransaksi === JenisTransaksi.ANGSURAN;

    // Jika transaksi butuh rekening tapi tidak dikirim maka error
    if (requiresRekening && !dto.rekeningSimpananId) {
      throw new BadRequestException('Rekening simpanan wajib diisi');
    }

    // Jika transaksi butuh pinjaman tapi tidak dikirim maka error
    if (requiresPinjaman && !dto.pinjamanId) {
      throw new BadRequestException('Pinjaman wajib diisi');
    }

    // Tidak boleh kirim dua-duanya sekaligus
    if (dto.rekeningSimpananId && dto.pinjamanId) {
      throw new BadRequestException(
        'Rekening simpanan dan pinjaman tidak boleh bersamaan',
      );
    }

    // Konversi nominal ke Decimal untuk perhitungam
    const nominal = this.toDecimal(dto.nominal);

    // Ambil data rekening jika diperlukan unutuk validasi dan perhitungan saldo
    const rekening = requiresRekening
      ? await this.transaksiRepository.findRekeningSimpananById(
          dto.rekeningSimpananId as number,
          dto.nasabahId,
        )
      : null;
    if (requiresRekening && !rekening) {
      throw new NotFoundException('Rekening simpanan tidak ditemukan');
    }

    // Ambil data pinjaman jika diperlukan untuk validasi dan perhitungan sisa pinjaman
    const pinjaman = requiresPinjaman
      ? await this.transaksiRepository.findPinjamanById(
          dto.pinjamanId as number,
          dto.nasabahId,
        )
      : null;
    if (requiresPinjaman && !pinjaman) {
      throw new NotFoundException('Pinjaman tidak ditemukan');
    }

    // LOGIC UPDATE REKENING
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

    // LOGIC UPDATE PINJAMAN
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

    // VALIDASI BATAS HARIAN
    // Dapatkan tanggal transaksi
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

    // Hitung total transaksi hari ini
    const dailyAgg =
      await this.transaksiRepository.sumNominalByNasabahPerTanggal({
        nasabahId: dto.nasabahId,
        tanggalFrom,
        tanggalTo,
      });
    const totalToday = Number(dailyAgg._sum.nominal ?? 0);

    // Jika melebihi batas maka error
    if (totalToday + dto.nominal > maxDailyNominal) {
      throw new BadRequestException(
        `Total transaksi harian melebihi batas maksimum ${maxDailyNominal}`,
      );
    }

    // TRANSACTION DATABASE
    const transaksi = await this.prisma.$transaction(async (tx) => {
      // Update rekening jika ada
      if (updateRekening) {
        await tx.rekeningSimpanan.update({
          where: { id: updateRekening.id },
          data: { saldoBerjalan: updateRekening.saldoBerjalan },
        });
      }

      // Update pinjaman jika ada
      if (updatePinjaman) {
        await tx.pinjaman.update({
          where: { id: updatePinjaman.id },
          data: {
            sisaPinjaman: updatePinjaman.sisaPinjaman,
            ...(updatePinjaman.status ? { status: updatePinjaman.status } : {}),
          },
        });
      }

      // Simpan transaksi utama
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

    // Menentukan entity aduit
    let entityName = 'transaksi';
    let entityId = transaksi.id;

    if (requiresRekening) {
      entityName = 'simpanan';
      entityId = dto.rekeningSimpananId as number;
    } else if (requiresPinjaman) {
      entityName = 'pinjaman';
      entityId = dto.pinjamanId as number;
    }

    // Catat audit trail
    await this.auditTrailService.log({
      action: AuditAction.CREATE,
      userId,
      entityName,
      entityId,
      before: {
        ...(rekening
          ? {
              rekeningSimpananId: rekening.id,
              saldoSebelum: Number(rekening.saldoBerjalan),
            }
          : {}),
        ...(pinjaman
          ? {
              pinjamanId: pinjaman.id,
              sisaPinjamanSebelum: Number(pinjaman.sisaPinjaman),
              statusPinjamanSebelum: pinjaman.status,
            }
          : {}),
      },
      after: {
        transaksiId: transaksi.id,
        jenisTransaksi: transaksi.jenisTransaksi,
        nominal: Number(transaksi.nominal),
        nasabahId: transaksi.nasabahId,
        ...(updateRekening
          ? { saldoSesudah: Number(updateRekening.saldoBerjalan) }
          : {}),
        ...(updatePinjaman
          ? {
              sisaPinjamanSesudah: Number(updatePinjaman.sisaPinjaman),
              statusPinjamanSesudah: updatePinjaman.status ?? pinjaman?.status,
            }
          : {}),
      },
    });

    return {
      message: 'Transaksi berhasil diproses',
      data: transaksi,
    };
  }

  async getTransaksiById(id: number) {
    const transaksi =
      await this.transaksiRepository.findTransaksiDetailById(id);
    if (!transaksi) {
      throw new NotFoundException('Transaksi tidak ditemukan');
    }

    return {
      message: 'Berhasil mengambil detail transaksi',
      data: transaksi,
    };
  }

  async softDeleteTransaksi(id: number, userId: number) {
    const transaksi =
      await this.transaksiRepository.findTransaksiSummaryById(id);
    if (!transaksi) {
      throw new NotFoundException('Transaksi tidak ditemukan');
    }

    await this.transaksiRepository.softDeleteTransaksi(id);
    await this.auditTrailService.log({
      action: 'DELETE' as AuditAction,
      userId,
      entityName: 'transaksi',
      entityId: transaksi.id,
      before: {
        id: transaksi.id,
        jenisTransaksi: transaksi.jenisTransaksi,
        nominal: Number(transaksi.nominal),
        nasabahId: transaksi.nasabahId,
        rekeningSimpananId: transaksi.rekeningSimpananId,
        pinjamanId: transaksi.pinjamanId,
        deletedAt: transaksi.deletedAt?.toISOString() ?? null,
      },
      after: {
        deletedAt: new Date().toISOString(),
      },
    });
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
    const nasabah = await this.transaksiRepository.findNasabahById(nasabahId);
    if (!nasabah) {
      throw new NotFoundException('Nasabah tidak ditemukan');
    }

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
    const pegawai = await this.transaksiRepository.findPegawaiById(pegawaiId);
    if (!pegawai) {
      throw new NotFoundException('Pegawai tidak ditemukan');
    }

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
    const rekening =
      await this.transaksiRepository.findRekeningSimpananByIdOnly(
        rekeningSimpananId,
      );
    if (!rekening) {
      throw new NotFoundException('Rekening simpanan tidak ditemukan');
    }

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
