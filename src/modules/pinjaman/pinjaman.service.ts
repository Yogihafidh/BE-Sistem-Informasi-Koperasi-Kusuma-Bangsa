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
  ListPinjamanQueryDto,
  PinjamanNominalSort,
  PencairanPinjamanDto,
  VerifikasiPinjamanDto,
} from './dto';
import { TransaksiRepository } from '../transaksi/transaksi.repository';
import { TransaksiService } from '../transaksi/transaksi.service';
import { DEFAULT_PAGE_SIZE } from '../../common/constants/pagination.constants';
import { AuditTrailService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { SETTING_KEYS } from '../settings/constants/settings.constants';
import { validateBidirectionalPaginationParams } from '../../common/utils/pagination.util';

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

  private calculateJatuhTempo(baseDate: Date, tenorBulan: number) {
    const jatuhTempo = new Date(baseDate);
    jatuhTempo.setUTCMonth(jatuhTempo.getUTCMonth() + tenorBulan);
    return jatuhTempo;
  }

  private async syncOverduePinjamanStatus(referenceDate = new Date()) {
    await this.prisma.pinjaman.updateMany({
      where: {
        deletedAt: null,
        status: PinjamanStatus.DISETUJUI,
        sisaPinjaman: { gt: new Prisma.Decimal(0) },
        jatuhTempo: {
          lt: referenceDate,
        },
      },
      data: {
        status: PinjamanStatus.TERLAMBAT,
      },
    });
  }

  private buildFlatSummary(args: {
    jumlahPinjaman: number | Prisma.Decimal;
    bungaPersen: number | Prisma.Decimal;
    tenorBulan: number;
    sisaPinjaman: number | Prisma.Decimal;
  }) {
    const jumlahPinjaman = Number(args.jumlahPinjaman);
    const bungaPersen = Number(args.bungaPersen);
    const tenorBulan = Number(args.tenorBulan);
    const totalBungaFlat = (jumlahPinjaman * bungaPersen * tenorBulan) / 100;
    const totalPengembalian = jumlahPinjaman + totalBungaFlat;
    const angsuranPerBulan =
      tenorBulan > 0 ? totalPengembalian / tenorBulan : 0;

    return {
      jumlahPinjaman,
      bungaPersen,
      tenorBulan,
      totalBungaFlat,
      totalPengembalian,
      angsuranPerBulan,
      sisaPinjaman: Number(args.sisaPinjaman),
    };
  }

  async createPinjaman(
    dto: CreatePinjamanDto,
    userId: number,
    ipAddress?: string,
  ) {
    // 1. Ambil Konfigurasi Sistem
    const [
      maxTenorMonths,
      minTenorMonths,
      maxLoanAmount,
      defaultInterestPercent,
      autoApprovalLimit,
      fixedPokokNominal,
    ] = await Promise.all([
      this.settingsService.getNumber(SETTING_KEYS.LOAN_MAX_TENOR_MONTHS),
      this.settingsService.getNumber(SETTING_KEYS.LOAN_MIN_TENOR_MONTHS),
      this.settingsService.getNumber(SETTING_KEYS.LOAN_MAX_LOAN_AMOUNT),
      this.settingsService.getNumber(
        SETTING_KEYS.LOAN_DEFAULT_INTEREST_PERCENT,
      ),
      this.settingsService.getNumber(SETTING_KEYS.LOAN_AUTO_APPROVAL_LIMIT),
      this.settingsService.getNumber(SETTING_KEYS.SAVINGS_MIN_INITIAL_DEPOSIT),
    ]);

    // 2. Validasi melebihi batas tenor
    if (dto.tenorBulan > maxTenorMonths) {
      throw new BadRequestException(
        `Tenor pinjaman melebihi batas maksimum ${maxTenorMonths} bulan`,
      );
    }

    // 3. Validasi kurang dari batas tenor
    if (dto.tenorBulan < minTenorMonths) {
      throw new BadRequestException(
        `Tenor pinjaman kurang dari batas minimum ${minTenorMonths} bulan`,
      );
    }

    // 4. Validasi jumlah pinjaman melebihi batas maksimum
    if (dto.jumlahPinjaman > maxLoanAmount) {
      throw new BadRequestException(
        `Jumlah pinjaman melebihi batas maksimum ${maxLoanAmount}`,
      );
    }

    // 5. Gunakan bunga default dari konfigurasi sistem
    const bungaPersen = defaultInterestPercent;

    // 6. Cek kondisi auto-approval berdasarkan jumlah pinjaman
    const isAutoApproved = dto.jumlahPinjaman <= autoApprovalLimit;

    // 7. Validasi nasabah harus ada dan aktif
    const nasabah = await this.pinjamanRepository.findNasabahById(
      dto.nasabahId,
    );
    if (!nasabah) {
      throw new NotFoundException('Nasabah tidak ditemukan');
    }

    if (nasabah.status !== NasabahStatus.AKTIF) {
      throw new BadRequestException('Nasabah tidak aktif');
    }

    const rekeningPokok =
      await this.pinjamanRepository.findRekeningPokokByNasabahId(dto.nasabahId);
    if (
      !rekeningPokok ||
      rekeningPokok.saldoBerjalan.lessThan(
        new Prisma.Decimal(fixedPokokNominal),
      )
    ) {
      throw new BadRequestException(
        'Pengajuan pinjaman tidak diperbolehkan karena simpanan pokok belum dibayar',
      );
    }

    // 8. Hitung parameter pinjaman
    const totalBungaFlat =
      (dto.jumlahPinjaman * bungaPersen * dto.tenorBulan) / 100;
    const totalPengembalian = dto.jumlahPinjaman + totalBungaFlat;
    const angsuranPerBulan = totalPengembalian / dto.tenorBulan;

    // 9. Proses create pinjaman
    const pinjaman = await this.prisma.$transaction(async (tx) => {
      // Create pinjaman
      const created = await this.pinjamanRepository.createPinjaman(
        {
          nasabahId: dto.nasabahId,
          jumlahPinjaman: dto.jumlahPinjaman,
          bungaPersen,
          tenorBulan: dto.tenorBulan,
          totalPengembalian,
          angsuranPerBulan,
          sisaPinjaman: 0,
          status: isAutoApproved
            ? PinjamanStatus.DISETUJUI
            : PinjamanStatus.PENDING,
          tanggalPersetujuan: isAutoApproved ? new Date() : null,
          jatuhTempo: null,
        },
        tx,
      );

      // Create audit trail pinjaman
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
      data: {
        id: pinjaman.id,
        nasabahId: pinjaman.nasabahId,
        ...this.buildFlatSummary({
          jumlahPinjaman: pinjaman.jumlahPinjaman,
          bungaPersen: pinjaman.bungaPersen,
          tenorBulan: pinjaman.tenorBulan,
          sisaPinjaman: pinjaman.sisaPinjaman,
        }),
        status: pinjaman.status,
        verifiedById: pinjaman.verifiedById,
        tanggalPersetujuan: pinjaman.tanggalPersetujuan,
        jatuhTempo: pinjaman.jatuhTempo,
      },
    };
  }

  async listPinjamanByNasabah(
    nasabahId: number,
    args: { after?: number; before?: number },
  ) {
    await this.syncOverduePinjamanStatus();

    const nasabah = await this.pinjamanRepository.findNasabahById(nasabahId);
    if (!nasabah) {
      throw new NotFoundException('Nasabah tidak ditemukan');
    }

    validateBidirectionalPaginationParams(args.after, args.before);

    const { data, nextCursor, prevCursor, hasNext, hasPrev } =
      await this.pinjamanRepository.listPinjamanByNasabah({
        nasabahId,
        page: {
          after: args.after,
          before: args.before,
          take: DEFAULT_PAGE_SIZE,
        },
      });

    const sanitizedData = data.map(({ verifiedById, ...item }) => ({
      ...item,
      ...this.buildFlatSummary({
        jumlahPinjaman: item.jumlahPinjaman,
        bungaPersen: item.bungaPersen,
        tenorBulan: item.tenorBulan,
        sisaPinjaman: item.sisaPinjaman,
      }),
    }));

    return {
      message: 'Berhasil mengambil data pinjaman nasabah',
      data: sanitizedData,
      pagination: {
        nextCursor,
        prevCursor,
        limit: DEFAULT_PAGE_SIZE,
        hasNext,
        hasPrev,
      },
    };
  }

  async listAllPinjaman(query: ListPinjamanQueryDto) {
    await this.syncOverduePinjamanStatus();

    const limit = DEFAULT_PAGE_SIZE;
    const after = query.after;
    const before = query.before;

    validateBidirectionalPaginationParams(after, before);

    let cursorNominal: Prisma.Decimal | undefined;
    let cursorId: number | undefined;

    if (typeof after === 'number' || typeof before === 'number') {
      cursorId = (after ?? before) as number;
      const anchor = await this.pinjamanRepository.findPinjamanCursorAnchor(
        cursorId,
        query.status,
      );

      if (!anchor) {
        throw new BadRequestException('Penanda halaman tidak valid');
      }

      cursorNominal = anchor.jumlahPinjaman;
    }

    const rows = await this.pinjamanRepository.listAllPinjaman({
      status: query.status,
      nominalSort:
        query.sort === PinjamanNominalSort.ASC
          ? Prisma.SortOrder.asc
          : Prisma.SortOrder.desc,
      page: {
        after,
        before,
        take: limit,
      },
      cursorNominal,
      cursorId,
    });

    const sortedRows = typeof before === 'number' ? [...rows].reverse() : rows;

    let nextCursor: number | null = null;
    let prevCursor: number | null = null;
    let hasNext = false;
    let hasPrev = false;

    if (sortedRows.length > 0) {
      prevCursor = sortedRows[0].id;
      const lastRow = sortedRows.at(-1)!;
      nextCursor = lastRow.id;

      const nominalSort =
        query.sort === PinjamanNominalSort.ASC
          ? Prisma.SortOrder.asc
          : Prisma.SortOrder.desc;

      const [prevItem, nextItem] = await Promise.all([
        this.pinjamanRepository.findPinjamanPrevByNominalBoundary({
          status: query.status,
          nominalSort,
          nominal: sortedRows[0].jumlahPinjaman,
          id: sortedRows[0].id,
        }),
        this.pinjamanRepository.findPinjamanNextByNominalBoundary({
          status: query.status,
          nominalSort,
          nominal: lastRow.jumlahPinjaman,
          id: lastRow.id,
        }),
      ]);

      hasPrev = Boolean(prevItem);
      hasNext = Boolean(nextItem);
    }

    const simplifiedData = sortedRows.map((item) => ({
      id: item.id,
      ...this.buildFlatSummary({
        jumlahPinjaman: item.jumlahPinjaman,
        bungaPersen: item.bungaPersen,
        tenorBulan: item.tenorBulan,
        sisaPinjaman: item.sisaPinjaman,
      }),
      status: item.status,
      nasabah: {
        nama: item.nasabah.nama,
      },
    }));

    return {
      message: 'Berhasil mengambil semua data pinjaman',
      data: simplifiedData,
      pagination: {
        limit,
        nextCursor,
        prevCursor,
        hasNext,
        hasPrev,
      },
    };
  }

  async getPinjamanDetail(id: number) {
    await this.syncOverduePinjamanStatus();

    const pinjaman = await this.pinjamanRepository.findPinjamanDetailById(id);
    if (!pinjaman) {
      throw new NotFoundException('Pinjaman tidak ditemukan');
    }

    return {
      message: 'Berhasil mengambil detail data pinjaman',
      data: [
        {
          id: pinjaman.id,
          ...this.buildFlatSummary({
            jumlahPinjaman: pinjaman.jumlahPinjaman,
            bungaPersen: pinjaman.bungaPersen,
            tenorBulan: pinjaman.tenorBulan,
            sisaPinjaman: pinjaman.sisaPinjaman,
          }),
          status: pinjaman.status,
          tanggalPersetujuan: pinjaman.tanggalPersetujuan,
          jatuhTempo: pinjaman.jatuhTempo,
          nasabah: {
            pegawaiId: pinjaman.nasabah.pegawaiId,
            nomorAnggota: pinjaman.nasabah.nomorAnggota,
            nama: pinjaman.nasabah.nama,
            nik: pinjaman.nasabah.nik,
            alamat: pinjaman.nasabah.alamat,
            noHp: pinjaman.nasabah.noHp,
            pekerjaan: pinjaman.nasabah.pekerjaan,
            instansi: pinjaman.nasabah.instansi,
            penghasilanBulanan: String(pinjaman.nasabah.penghasilanBulanan),
            tanggalLahir: pinjaman.nasabah.tanggalLahir,
            tanggalDaftar: pinjaman.nasabah.tanggalDaftar,
            status: pinjaman.nasabah.status,
            catatan: pinjaman.nasabah.catatan,
          },
          verifiedBy: pinjaman.verifiedBy
            ? {
                nama: pinjaman.verifiedBy.nama,
                jabatan: pinjaman.verifiedBy.jabatan,
                noHp: pinjaman.verifiedBy.noHp,
              }
            : null,
        },
      ],
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
    await this.syncOverduePinjamanStatus();

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
    await this.syncOverduePinjamanStatus();

    const pinjaman = await this.pinjamanRepository.findPinjamanById(id);
    if (!pinjaman) {
      throw new NotFoundException('Pinjaman tidak ditemukan');
    }

    if (
      pinjaman.status !== PinjamanStatus.DISETUJUI &&
      pinjaman.status !== PinjamanStatus.TERLAMBAT
    ) {
      throw new BadRequestException('Pinjaman belum disetujui');
    }

    const pencairanAgg = await this.pinjamanRepository.findPencairanTransaksi(
      pinjaman.id,
    );
    const totalPencairan = pencairanAgg._sum.nominal ?? this.toDecimal(0);
    if (totalPencairan.lessThanOrEqualTo(this.toDecimal(0))) {
      throw new BadRequestException('Pinjaman belum dicairkan');
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

  async listTransaksiByPinjaman(
    pinjamanId: number,
    args: { after?: number; before?: number },
  ) {
    await this.syncOverduePinjamanStatus();

    const pinjaman = await this.pinjamanRepository.findPinjamanById(pinjamanId);
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
      message: 'Berhasil mengambil histori transaksi pinjaman',
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

  async softDeletePinjaman(id: number, userId: number) {
    const pinjaman = await this.pinjamanRepository.findPinjamanById(id);
    if (!pinjaman) {
      throw new NotFoundException('Pinjaman tidak ditemukan');
    }

    await this.pinjamanRepository.softDeletePinjaman(id);
    // ALUR AUDIT MODUL PINJAMAN
    // Implementasi insert audit trail saat pinjaman di-soft-delete.
    await this.auditTrailService.log({
      action: 'DELETE' as AuditAction,
      userId,
      entityName: 'pinjaman',
      entityId: pinjaman.id,
      before: {
        id: pinjaman.id,
        nasabahId: pinjaman.nasabahId,
        jumlahPinjaman: Number(pinjaman.jumlahPinjaman),
        sisaPinjaman: Number(pinjaman.sisaPinjaman),
        status: pinjaman.status,
        deletedAt: pinjaman.deletedAt?.toISOString() ?? null,
      },
      after: {
        deletedAt: new Date().toISOString(),
      },
    });
    return {
      message: 'Pinjaman berhasil dihapus',
    };
  }
}
