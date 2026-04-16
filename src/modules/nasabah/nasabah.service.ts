import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  JenisDokumen,
  JenisSimpanan,
  JenisTransaksi,
  NasabahStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { NasabahListRow, NasabahRepository } from './nasabah.repository';
import {
  CreateNasabahDto,
  NasabahDetailDto,
  NasabahListDto,
  UpdateNasabahDto,
  VerifikasiNasabahDto,
  UpdateNasabahStatusDto,
} from './dto';
import { MinioService } from '../../common/storage/minio.service';
import { DEFAULT_PAGE_SIZE } from '../../common/constants/pagination.constants';
import { validateBidirectionalPaginationParams } from '../../common/utils/pagination.util';
import { AuditTrailService } from '../audit/audit.service';

type UploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

type UploadFiles = {
  ktp?: UploadFile[];
  kk?: UploadFile[];
  slipGaji?: UploadFile[];
};

const DOKUMEN_MIME_ALLOWED = ['image/jpeg', 'image/png', 'application/pdf'];

type RequestUser = {
  userId: number;
  roles: string[];
};

type StatusAktivitas = 'AKTIF' | 'KURANG_AKTIF' | 'TIDAK_AKTIF';
type StatusPinjaman = 'AMAN' | 'BERISIKO';

export type NasabahRealtimeSummaryResponse = {
  nasabah: {
    id: string;
    nama: string;
    status: 'AKTIF' | 'NONAKTIF';
  };
  keuangan: {
    saldoSaatIni: number;
    totalSimpanan: number;
    sisaPinjaman: number;
  };
  transaksi: {
    transaksiBulanIni: number;
    lastTransactionAt: string | null;
  };
  status: {
    statusAktivitas: StatusAktivitas;
    statusPinjaman: StatusPinjaman;
  };
  meta: {
    generatedAt: string;
  };
};

export type NasabahDashboardResponse = {
  highlight: {
    saldo: number;
    sisaPinjaman: number;
    statusPinjaman: StatusPinjaman;
  };
  aktivitas: {
    statusAktivitas: StatusAktivitas;
    transaksiBulanIni: number;
    hariAktif: number;
  };
  tren: {
    cashflow: Array<{
      bulan: string;
      masuk: number;
      keluar: number;
    }>;
  };
  pinjaman: {
    trenSisaPinjaman: Array<{
      bulan: string;
      sisa: number;
    }>;
  };
  rasio: {
    rasioMenabung: number;
    rasioPinjaman: number;
  };
  insight: {
    kategori: string;
    highlight: string;
    rekomendasi: string[];
  };
  meta: {
    generatedAt: string;
  };
};

@Injectable()
export class NasabahService {
  private readonly logger = new Logger(NasabahService.name);

  constructor(
    private readonly nasabahRepository: NasabahRepository,
    private readonly minioService: MinioService,
    private readonly auditTrailService: AuditTrailService,
    private readonly prisma: PrismaClient,
  ) {}

  private pickNasabahAuditFields(data: {
    pegawaiId?: number | null;
    nomorAnggota?: string | null;
    nama?: string | null;
    nik?: string | null;
    alamat?: string | null;
    noHp?: string | null;
    pekerjaan?: string | null;
    instansi?: string | null;
    penghasilanBulanan?: number | Prisma.Decimal | null;
    tanggalLahir?: Date | string | null;
    tanggalDaftar?: Date | string | null;
    status?: NasabahStatus | null;
    catatan?: string | null;
  }) {
    const penghasilan = data.penghasilanBulanan;
    const tanggalLahir = data.tanggalLahir;
    const tanggalDaftar = data.tanggalDaftar;

    return {
      pegawaiId: data.pegawaiId ?? null,
      nomorAnggota: data.nomorAnggota ?? null,
      nama: data.nama ?? null,
      nik: data.nik ?? null,
      alamat: data.alamat ?? null,
      noHp: data.noHp ?? null,
      pekerjaan: data.pekerjaan ?? null,
      instansi: data.instansi ?? null,
      penghasilanBulanan: penghasilan == null ? null : Number(penghasilan),
      tanggalLahir:
        tanggalLahir instanceof Date
          ? tanggalLahir.toISOString()
          : (tanggalLahir ?? null),
      tanggalDaftar:
        tanggalDaftar instanceof Date
          ? tanggalDaftar.toISOString()
          : (tanggalDaftar ?? null),
      status: data.status ?? null,
      catatan: data.catatan ?? null,
    };
  }

  private toNasabahListDto(item: NasabahListRow): NasabahListDto {
    return {
      id: item.id,
      nomorAnggota: item.nomorAnggota,
      nama: item.nama,
      nik: item.nik,
      noHp: item.noHp,
      pekerjaan: item.pekerjaan,
      instansi: item.instansi ?? null,
      status: item.status,
      tanggalDaftar: item.tanggalDaftar,
    };
  }

  private toAccessibleDokumenUrls<
    T extends {
      dokumen?: Array<{
        id: number;
        nasabahId: number;
        jenisDokumen: JenisDokumen;
        fileKey: string;
        uploadedAt: Date;
      }>;
    },
  >(data: T): T {
    if (!data.dokumen || data.dokumen.length === 0) {
      return data;
    }

    const latestByJenis = new Map<
      JenisDokumen,
      {
        id: number;
        nasabahId: number;
        jenisDokumen: JenisDokumen;
        fileKey: string;
        uploadedAt: Date;
      }
    >();

    for (const item of data.dokumen) {
      const existing = latestByJenis.get(item.jenisDokumen);
      if (
        !existing ||
        item.uploadedAt.getTime() > existing.uploadedAt.getTime()
      ) {
        latestByJenis.set(item.jenisDokumen, item);
      }
    }

    const dokumen = Array.from(latestByJenis.values()).map((item) => {
      const fileUrl = this.minioService.buildAccessibleUrlFromStoredUrl(
        item.fileKey,
      );

      return {
        id: item.id,
        nasabahId: item.nasabahId,
        jenisDokumen: item.jenisDokumen,
        fileUrl,
        uploadedAt: item.uploadedAt,
      };
    });

    return {
      ...data,
      dokumen,
    };
  }

  private isSuperAdmin(user: RequestUser) {
    return user.roles.some(
      (role) => role.trim().toLowerCase() === 'super admin',
    );
  }

  private isAdmin(user: RequestUser) {
    return user.roles.some((role) => role.trim().toLowerCase() === 'admin');
  }

  private isAdminOrSuperAdmin(user: RequestUser) {
    return this.isAdmin(user) || this.isSuperAdmin(user);
  }

  private toNumber(value: unknown): number {
    if (value == null) {
      return 0;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    if (typeof value === 'object' && value !== null && 'toString' in value) {
      const parsed = Number((value as { toString: () => string }).toString());
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }

  private safeDivide(numerator: number, denominator: number): number {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
      return 0;
    }

    if (denominator === 0) {
      return 0;
    }

    const result = numerator / denominator;
    return Number.isFinite(result) ? result : 0;
  }

  private sanitizeNumber(value: number): number {
    return Number.isFinite(value) ? value : 0;
  }

  private formatDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private formatMonthYear(date: Date): string {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    return `${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }

  private getCurrentMonthRange() {
    const now = new Date();
    const from = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    );
    const to = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    );
    return { from, to };
  }

  private getMonthStartOffset(offsetFromCurrentMonth: number) {
    const now = new Date();
    return new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() + offsetFromCurrentMonth,
        1,
      ),
    );
  }

  private normalizeTransaksiByJenis(
    rows: Array<{
      jenisTransaksi: JenisTransaksi;
      _sum: { nominal: unknown };
      _count?: { _all: number };
    }>,
  ) {
    const result: Record<JenisTransaksi, { nominal: number; count: number }> = {
      [JenisTransaksi.SETORAN]: { nominal: 0, count: 0 },
      [JenisTransaksi.PENARIKAN]: { nominal: 0, count: 0 },
      [JenisTransaksi.PENCAIRAN]: { nominal: 0, count: 0 },
      [JenisTransaksi.ANGSURAN]: { nominal: 0, count: 0 },
    };

    for (const row of rows) {
      result[row.jenisTransaksi] = {
        nominal: this.toNumber(row._sum.nominal),
        count: row._count?._all ?? 0,
      };
    }

    return result;
  }

  private getStatusAktivitas(transaksiBulanIni: number): StatusAktivitas {
    if (transaksiBulanIni === 0) {
      return 'TIDAK_AKTIF';
    }

    if (transaksiBulanIni < 5) {
      return 'KURANG_AKTIF';
    }

    return 'AKTIF';
  }

  private getStatusPinjaman(
    totalPinjaman: number,
    totalSimpanan: number,
  ): StatusPinjaman {
    if (totalSimpanan === 0) {
      return 'BERISIKO';
    }

    return this.safeDivide(totalPinjaman, totalSimpanan) > 1
      ? 'BERISIKO'
      : 'AMAN';
  }

  private async getSharedNasabahMetrics(id: number, user: RequestUser) {
    const nasabah = await this.nasabahRepository.findNasabahSummaryById(id);
    if (!nasabah) {
      throw new NotFoundException('Nasabah tidak ditemukan');
    }

    if (!this.isAdminOrSuperAdmin(user)) {
      const pegawaiPenanggungJawab =
        await this.nasabahRepository.findPegawaiById(nasabah.pegawaiId);

      if (pegawaiPenanggungJawab?.userId !== user.userId) {
        throw new ForbiddenException(
          'Anda tidak berhak mengakses data nasabah ini',
        );
      }
    }

    const { from: currentMonthFrom, to: currentMonthTo } =
      this.getCurrentMonthRange();

    const [
      transaksiAllTimeRows,
      simpananByJenisRows,
      pinjamanSnapshotRows,
      transaksiBulanIni,
      hariAktifRows,
      lastTransactionAgg,
    ] = await Promise.all([
      this.nasabahRepository.groupTransaksiNasabahByJenisAllTime(id),
      this.nasabahRepository.groupSaldoSimpananNasabahByJenis(id),
      this.nasabahRepository.getPinjamanNasabahSnapshot(id),
      this.nasabahRepository.countTransaksiNasabahInRange({
        nasabahId: id,
        tanggalFrom: currentMonthFrom,
        tanggalTo: currentMonthTo,
      }),
      this.nasabahRepository.countDistinctHariAktifNasabahInRange({
        nasabahId: id,
        tanggalFrom: currentMonthFrom,
        tanggalTo: currentMonthTo,
      }),
      this.nasabahRepository.getLastTransactionAtNasabah(id),
    ]);

    const transaksiByJenis =
      this.normalizeTransaksiByJenis(transaksiAllTimeRows);
    const totalPemasukan =
      transaksiByJenis[JenisTransaksi.SETORAN].nominal +
      transaksiByJenis[JenisTransaksi.ANGSURAN].nominal;
    const totalPengeluaran =
      transaksiByJenis[JenisTransaksi.PENARIKAN].nominal +
      transaksiByJenis[JenisTransaksi.PENCAIRAN].nominal;

    const saldoSaatIni = totalPemasukan - totalPengeluaran;

    const simpananPokok = this.toNumber(
      simpananByJenisRows.find(
        (item) => item.jenisSimpanan === JenisSimpanan.POKOK,
      )?._sum.saldoBerjalan,
    );
    const simpananWajib = this.toNumber(
      simpananByJenisRows.find(
        (item) => item.jenisSimpanan === JenisSimpanan.WAJIB,
      )?._sum.saldoBerjalan,
    );
    const simpananSukarela = this.toNumber(
      simpananByJenisRows.find(
        (item) => item.jenisSimpanan === JenisSimpanan.SUKARELA,
      )?._sum.saldoBerjalan,
    );
    const totalSimpanan = simpananPokok + simpananWajib + simpananSukarela;

    const pinjamanSnapshot = pinjamanSnapshotRows[0];
    const totalPinjaman = this.toNumber(pinjamanSnapshot?.totalPinjaman ?? 0);
    const sisaPinjaman = this.toNumber(pinjamanSnapshot?.sisaPinjaman ?? 0);
    const hariAktif = this.toNumber(hariAktifRows[0]?.count ?? 0);

    const statusAktivitas = this.getStatusAktivitas(transaksiBulanIni);
    const statusPinjaman = this.getStatusPinjaman(totalPinjaman, totalSimpanan);
    const rasioMenabung = this.safeDivide(totalSimpanan, totalPemasukan);
    const rasioPinjaman = this.safeDivide(totalPinjaman, totalSimpanan);

    return {
      nasabah,
      saldoSaatIni: this.sanitizeNumber(saldoSaatIni),
      totalSimpanan: this.sanitizeNumber(totalSimpanan),
      totalPinjaman: this.sanitizeNumber(totalPinjaman),
      sisaPinjaman: this.sanitizeNumber(sisaPinjaman),
      transaksiBulanIni: this.sanitizeNumber(transaksiBulanIni),
      hariAktif: this.sanitizeNumber(hariAktif),
      lastTransactionAt: lastTransactionAgg._max.tanggal
        ? this.formatDateOnly(lastTransactionAgg._max.tanggal)
        : null,
      statusAktivitas,
      statusPinjaman,
      rasioMenabung: this.sanitizeNumber(rasioMenabung),
      rasioPinjaman: this.sanitizeNumber(rasioPinjaman),
      totalPemasukanAllTime: this.sanitizeNumber(totalPemasukan),
      currentMonthFrom,
      currentMonthTo,
    };
  }

  private async generateNomorAnggota() {
    const prefix = 'AGT';
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    for (let i = 0; i < 5; i += 1) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      const nomorAnggota = `${prefix}-${y}${m}${d}-${rand}`;
      const existing =
        await this.nasabahRepository.findNasabahByNomorAnggota(nomorAnggota);
      if (!existing) {
        return nomorAnggota;
      }
    }

    throw new BadRequestException('Gagal menghasilkan nomor anggota');
  }

  async createNasabah(
    dto: CreateNasabahDto,
    userId: number,
    ipAddress?: string,
  ) {
    const pegawai = await this.nasabahRepository.findPegawaiByUserId(userId);
    if (!pegawai) {
      throw new NotFoundException('Pegawai tidak ditemukan');
    }

    const existingNik = await this.nasabahRepository.findNasabahByNik(dto.nik);
    if (existingNik) {
      throw new ConflictException('NIK sudah terdaftar');
    }

    const nomorAnggota = await this.generateNomorAnggota();
    const tanggalDaftar = dto.tanggalDaftar
      ? new Date(dto.tanggalDaftar)
      : new Date();

    const nasabah = await this.prisma.$transaction(async (tx) => {
      const created = await this.nasabahRepository.createNasabah(
        {
          pegawaiId: pegawai.id,
          nomorAnggota,
          nama: dto.nama,
          nik: dto.nik,
          alamat: dto.alamat,
          noHp: dto.noHp,
          pekerjaan: dto.pekerjaan,
          instansi: dto.instansi,
          penghasilanBulanan: dto.penghasilanBulanan,
          tanggalLahir: new Date(dto.tanggalLahir),
          tanggalDaftar,
          status: NasabahStatus.PENDING,
          catatan: dto.catatan,
        },
        tx,
      );

      await this.auditTrailService.log(
        {
          action: AuditAction.CREATE,
          entityName: 'Nasabah',
          entityId: created.id,
          userId,
          after: this.pickNasabahAuditFields({
            nomorAnggota: created.nomorAnggota,
            nama: created.nama,
            nik: created.nik,
            alamat: created.alamat,
            noHp: created.noHp,
            pekerjaan: created.pekerjaan,
            instansi: created.instansi ?? null,
            penghasilanBulanan: created.penghasilanBulanan,
            tanggalLahir: created.tanggalLahir,
            tanggalDaftar: created.tanggalDaftar,
            status: created.status,
            catatan: created.catatan ?? null,
          }),
          ipAddress,
        },
        tx,
      );

      return created;
    });

    return {
      message: 'Registrasi nasabah berhasil',
      data: nasabah,
    };
  }

  async getAllNasabah(
    args: { after?: number; before?: number },
    user: RequestUser,
    status?: NasabahStatus,
    pegawaiId?: number,
  ) {
    validateBidirectionalPaginationParams(args.after, args.before);

    let effectivePegawaiId: number | undefined;

    if (pegawaiId !== undefined) {
      const pegawai = await this.nasabahRepository.findPegawaiById(pegawaiId);
      if (!pegawai) {
        throw new NotFoundException('Pegawai tidak ditemukan');
      }
    }

    if (this.isAdminOrSuperAdmin(user)) {
      effectivePegawaiId = pegawaiId;
    } else {
      if (pegawaiId === undefined) {
        throw new BadRequestException('pegawaiId wajib diisi');
      }

      const pegawaiRequester = await this.nasabahRepository.findPegawaiByUserId(
        user.userId,
      );
      if (!pegawaiRequester) {
        throw new NotFoundException('Pegawai tidak ditemukan');
      }

      if (pegawaiRequester.id !== pegawaiId) {
        throw new ForbiddenException(
          'Anda tidak berhak mengakses data nasabah pegawai lain',
        );
      }

      effectivePegawaiId = pegawaiId;
    }

    const { data, nextCursor, prevCursor, hasNext, hasPrev } =
      await this.nasabahRepository.findAllNasabah(
        {
          after: args.after,
          before: args.before,
          take: DEFAULT_PAGE_SIZE,
        },
        status,
        effectivePegawaiId,
      );

    return {
      message: 'Berhasil mengambil data nasabah',
      data: data.map((item) => this.toNasabahListDto(item)),
      pagination: {
        nextCursor,
        prevCursor,
        limit: DEFAULT_PAGE_SIZE,
        hasNext,
        hasPrev,
      },
    };
  }

  async getNasabahById(id: number, user: RequestUser) {
    this.logger.log(`[NASABAH_DETAIL] START get detail nasabah id=${id}`);
    console.time(`[NASABAH_DETAIL] total-${id}`);
    this.logger.log('[NASABAH_DETAIL] BEFORE DB QUERY');
    const nasabah = await this.nasabahRepository.findNasabahById(id);
    this.logger.log('[NASABAH_DETAIL] AFTER DB QUERY');
    if (!nasabah) {
      console.timeEnd(`[NASABAH_DETAIL] total-${id}`);
      throw new NotFoundException('Nasabah tidak ditemukan');
    }

    if (!this.isSuperAdmin(user)) {
      const pegawaiPenanggungJawab =
        await this.nasabahRepository.findPegawaiById(nasabah.pegawaiId);

      if (pegawaiPenanggungJawab?.userId !== user.userId) {
        throw new ForbiddenException(
          'Anda tidak berhak mengakses dokumen nasabah ini',
        );
      }
    }

    const nasabahWithAccessibleDokumen = this.toAccessibleDokumenUrls(nasabah);

    this.logger.log('[NASABAH_DETAIL] RETURN response');
    console.timeEnd(`[NASABAH_DETAIL] total-${id}`);

    return {
      message: 'Berhasil mengambil data nasabah',
      data: nasabahWithAccessibleDokumen as unknown as NasabahDetailDto,
    };
  }

  async getNasabahSummary(
    id: number,
    user: RequestUser,
  ): Promise<NasabahRealtimeSummaryResponse> {
    const shared = await this.getSharedNasabahMetrics(id, user);

    return {
      nasabah: {
        id: String(shared.nasabah.id),
        nama: shared.nasabah.nama,
        status: shared.nasabah.status === 'AKTIF' ? 'AKTIF' : 'NONAKTIF',
      },
      keuangan: {
        saldoSaatIni: shared.saldoSaatIni,
        totalSimpanan: shared.totalSimpanan,
        sisaPinjaman: shared.sisaPinjaman,
      },
      transaksi: {
        transaksiBulanIni: shared.transaksiBulanIni,
        lastTransactionAt: shared.lastTransactionAt,
      },
      status: {
        statusAktivitas: shared.statusAktivitas,
        statusPinjaman: shared.statusPinjaman,
      },
      meta: {
        generatedAt: new Date().toISOString(),
      },
    };
  }

  async getNasabahDashboard(
    id: number,
    user: RequestUser,
  ): Promise<NasabahDashboardResponse> {
    const shared = await this.getSharedNasabahMetrics(id, user);

    const fromMonth = this.getMonthStartOffset(-5);
    const toMonth = this.getMonthStartOffset(0);

    const [cashflowRows, trenSisaPinjamanRows] = await Promise.all([
      this.nasabahRepository.getCashflowTrendNasabah({
        nasabahId: id,
        fromMonth,
        toMonth,
      }),
      this.nasabahRepository.getTrenSisaPinjamanNasabah({
        nasabahId: id,
        fromMonth,
        toMonth,
      }),
    ]);

    let kategori = 'PASIF';
    if (
      shared.statusAktivitas === 'AKTIF' &&
      shared.rasioMenabung > 0.5 &&
      shared.rasioPinjaman <= 1
    ) {
      kategori = 'AKTIF_PRODUKTIF';
    } else if (shared.statusAktivitas === 'AKTIF' && shared.rasioPinjaman > 1) {
      kategori = 'AKTIF_BERISIKO';
    }

    let highlight = 'Aktivitas transaksi Anda masih rendah';
    if (kategori === 'AKTIF_PRODUKTIF') {
      highlight = 'Keuangan Anda dalam kondisi sehat';
    } else if (kategori === 'AKTIF_BERISIKO') {
      highlight = 'Perlu perhatian terhadap pinjaman Anda';
    }

    const rekomendasi: string[] = [];
    if (shared.rasioMenabung <= 0.5) {
      rekomendasi.push('Tingkatkan frekuensi menabung');
    }
    if (shared.rasioPinjaman > 1) {
      rekomendasi.push('Pertimbangkan mengurangi pinjaman');
    }
    if (shared.statusAktivitas !== 'AKTIF') {
      rekomendasi.push('Tingkatkan aktivitas transaksi');
    }

    return {
      highlight: {
        saldo: shared.saldoSaatIni,
        sisaPinjaman: shared.sisaPinjaman,
        statusPinjaman: shared.statusPinjaman,
      },
      aktivitas: {
        statusAktivitas: shared.statusAktivitas,
        transaksiBulanIni: shared.transaksiBulanIni,
        hariAktif: shared.hariAktif,
      },
      tren: {
        cashflow: cashflowRows.map((row) => ({
          bulan: this.formatMonthYear(new Date(row.monthStart)),
          masuk: this.sanitizeNumber(this.toNumber(row.masuk)),
          keluar: this.sanitizeNumber(this.toNumber(row.keluar)),
        })),
      },
      pinjaman: {
        trenSisaPinjaman: trenSisaPinjamanRows.map((row) => ({
          bulan: this.formatMonthYear(new Date(row.monthStart)),
          sisa: this.sanitizeNumber(this.toNumber(row.sisa)),
        })),
      },
      rasio: {
        rasioMenabung: shared.rasioMenabung,
        rasioPinjaman: shared.rasioPinjaman,
      },
      insight: {
        kategori,
        highlight,
        rekomendasi,
      },
      meta: {
        generatedAt: new Date().toISOString(),
      },
    };
  }

  async updateNasabah(
    id: number,
    dto: UpdateNasabahDto,
    userId: number,
    ipAddress?: string,
  ) {
    const nasabah = await this.nasabahRepository.findNasabahById(id);
    if (!nasabah) {
      throw new NotFoundException('Nasabah tidak ditemukan');
    }

    if (dto.pegawaiId !== undefined) {
      const pegawai = await this.nasabahRepository.findPegawaiById(
        dto.pegawaiId,
      );
      if (!pegawai) {
        throw new NotFoundException('Pegawai tidak ditemukan');
      }

      if (!pegawai.statusAktif) {
        throw new BadRequestException('Pegawai tidak aktif');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await this.nasabahRepository.updateNasabah(
        id,
        {
          ...dto,
          tanggalLahir: dto.tanggalLahir
            ? new Date(dto.tanggalLahir)
            : undefined,
        },
        tx,
      );

      await this.auditTrailService.log(
        {
          action: AuditAction.UPDATE,
          entityName: 'Nasabah',
          entityId: id,
          userId,
          before: this.pickNasabahAuditFields({
            pegawaiId: nasabah.pegawaiId,
            nomorAnggota: nasabah.nomorAnggota,
            nama: nasabah.nama,
            nik: nasabah.nik,
            alamat: nasabah.alamat,
            noHp: nasabah.noHp,
            pekerjaan: nasabah.pekerjaan,
            instansi: nasabah.instansi ?? null,
            penghasilanBulanan: nasabah.penghasilanBulanan,
            tanggalLahir: nasabah.tanggalLahir,
            tanggalDaftar: nasabah.tanggalDaftar,
            status: nasabah.status,
            catatan: nasabah.catatan ?? null,
          }),
          after: this.pickNasabahAuditFields({
            pegawaiId: result.pegawaiId,
            nomorAnggota: result.nomorAnggota,
            nama: result.nama,
            nik: result.nik,
            alamat: result.alamat,
            noHp: result.noHp,
            pekerjaan: result.pekerjaan,
            instansi: result.instansi ?? null,
            penghasilanBulanan: result.penghasilanBulanan,
            tanggalLahir: result.tanggalLahir,
            tanggalDaftar: result.tanggalDaftar,
            status: result.status,
            catatan: result.catatan ?? null,
          }),
          ipAddress,
        },
        tx,
      );

      return result;
    });

    return {
      message: 'Data nasabah berhasil diperbarui',
      data: updated,
    };
  }

  async uploadDokumen(
    nasabahId: number,
    files: UploadFiles,
    user: RequestUser,
  ) {
    const nasabah = await this.nasabahRepository.findNasabahById(nasabahId);
    if (!nasabah) {
      throw new NotFoundException('Nasabah tidak ditemukan');
    }

    if (!this.isSuperAdmin(user)) {
      const pegawaiPenanggungJawab =
        await this.nasabahRepository.findPegawaiById(nasabah.pegawaiId);

      if (pegawaiPenanggungJawab?.userId !== user.userId) {
        throw new ForbiddenException(
          'Anda tidak berhak mengunggah dokumen untuk nasabah ini',
        );
      }
    }

    const ktpFile = files.ktp?.[0];
    const kkFile = files.kk?.[0];
    const slipFile = files.slipGaji?.[0];

    if (!ktpFile) {
      throw new BadRequestException('Dokumen KTP wajib diunggah');
    }

    if (!kkFile) {
      throw new BadRequestException('Dokumen KK wajib diunggah');
    }

    this.validateFile(ktpFile, DOKUMEN_MIME_ALLOWED, 2);
    this.validateFile(kkFile, DOKUMEN_MIME_ALLOWED, 2);

    if (slipFile) {
      this.validateFile(slipFile, DOKUMEN_MIME_ALLOWED, 5);
    }

    const dokumenUploads: Array<{
      jenis: JenisDokumen;
      file: UploadFile;
    }> = [
      { jenis: JenisDokumen.KTP, file: ktpFile },
      { jenis: JenisDokumen.KK, file: kkFile },
    ];

    if (slipFile) {
      dokumenUploads.push({ jenis: JenisDokumen.SLIP_GAJI, file: slipFile });
    }

    const existingDokumen = await Promise.all(
      dokumenUploads.map((item) =>
        this.nasabahRepository.findNasabahDokumenByJenis(nasabahId, item.jenis),
      ),
    );

    const duplicatedJenis = dokumenUploads
      .filter((_, index) => Boolean(existingDokumen[index]))
      .map((item) => item.jenis);

    if (duplicatedJenis.length > 0) {
      throw new BadRequestException(
        `Dokumen ${duplicatedJenis.join(', ')} sudah ada untuk nasabah ini. Gunakan endpoint update dokumen per jenis.`,
      );
    }

    const results = await Promise.all(
      dokumenUploads.map(async (item) => {
        const bucket = this.minioService.getBucketNameForJenis(item.jenis);
        const safeName = item.file.originalname.replaceAll(/\s+/g, '-');
        const objectName = `nasabah/${nasabahId}/${item.jenis.toLowerCase()}-${Date.now()}-${safeName}`;

        await this.minioService.uploadObject(
          bucket,
          objectName,
          item.file.buffer,
          item.file.mimetype,
        );

        const fileKey = this.minioService.buildObjectKey(bucket, objectName);
        const dokumen = await this.nasabahRepository.createNasabahDokumen({
          nasabahId,
          jenisDokumen: item.jenis,
          fileKey,
        });

        const accessibleFileUrl = this.minioService.buildAccessibleUrl(
          bucket,
          objectName,
        );

        return {
          id: dokumen.id,
          nasabahId: dokumen.nasabahId,
          jenisDokumen: dokumen.jenisDokumen,
          fileUrl: accessibleFileUrl,
          uploadedAt: dokumen.uploadedAt,
        };
      }),
    );

    return {
      message: 'Upload dokumen berhasil',
      data: results,
    };
  }

  async updateDokumenNasabah(
    nasabahId: number,
    jenisDokumen: JenisDokumen,
    file: UploadFile,
    user: RequestUser,
    ipAddress?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File dokumen wajib diunggah');
    }

    const nasabah = await this.nasabahRepository.findNasabahById(nasabahId);
    if (!nasabah) {
      throw new NotFoundException('Nasabah tidak ditemukan');
    }

    if (!this.isSuperAdmin(user)) {
      const pegawaiPenanggungJawab =
        await this.nasabahRepository.findPegawaiById(nasabah.pegawaiId);

      if (pegawaiPenanggungJawab?.userId !== user.userId) {
        throw new ForbiddenException(
          'Anda tidak berhak memperbarui dokumen nasabah ini',
        );
      }
    }

    const allowedMime = DOKUMEN_MIME_ALLOWED;
    const maxSizeMb = jenisDokumen === JenisDokumen.SLIP_GAJI ? 5 : 2;
    this.validateFile(file, allowedMime, maxSizeMb);

    const bucket = this.minioService.getBucketNameForJenis(jenisDokumen);
    const safeName = file.originalname.replaceAll(/\s+/g, '-');
    const objectName = `nasabah/${nasabahId}/${jenisDokumen.toLowerCase()}-${Date.now()}-${safeName}`;

    await this.minioService.uploadObject(
      bucket,
      objectName,
      file.buffer,
      file.mimetype,
    );

    const existing = await this.nasabahRepository.findNasabahDokumenByJenis(
      nasabahId,
      jenisDokumen,
    );

    const oldStoredRef = existing?.fileKey;
    if (oldStoredRef) {
      try {
        await this.minioService.deleteObjectByStoredRef(oldStoredRef);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Gagal menghapus file lama MinIO saat update dokumen nasabah ${nasabahId}: ${message}`,
        );
      }
    }

    const fileKey = this.minioService.buildObjectKey(bucket, objectName);
    const updatedDokumen = existing
      ? await this.nasabahRepository.updateNasabahDokumen(existing.id, {
          fileKey,
          uploadedAt: new Date(),
        })
      : await this.nasabahRepository.createNasabahDokumen({
          nasabahId,
          jenisDokumen,
          fileKey,
        });

    await this.auditTrailService.log({
      action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
      entityName: 'NasabahDokumen',
      entityId: updatedDokumen.id,
      userId: user.userId,
      before: existing
        ? {
            nasabahId: existing.nasabahId,
            jenisDokumen: existing.jenisDokumen,
            fileKey: existing.fileKey,
            uploadedAt: existing.uploadedAt.toISOString(),
          }
        : null,
      after: {
        nasabahId: updatedDokumen.nasabahId,
        jenisDokumen: updatedDokumen.jenisDokumen,
        fileKey: updatedDokumen.fileKey,
        uploadedAt: updatedDokumen.uploadedAt.toISOString(),
      },
      ipAddress,
    });

    const accessibleFileUrl = this.minioService.buildAccessibleUrl(
      bucket,
      objectName,
    );

    return {
      message: 'Dokumen nasabah berhasil diperbarui',
      data: {
        id: updatedDokumen.id,
        nasabahId: updatedDokumen.nasabahId,
        jenisDokumen: updatedDokumen.jenisDokumen,
        fileUrl: accessibleFileUrl,
        uploadedAt: updatedDokumen.uploadedAt,
      },
    };
  }

  async deleteDokumenNasabah(
    dokumenId: number,
    user: RequestUser,
    ipAddress?: string,
  ) {
    const dokumen =
      await this.nasabahRepository.findNasabahDokumenById(dokumenId);
    if (!dokumen) {
      throw new NotFoundException('Dokumen nasabah tidak ditemukan');
    }

    if (dokumen.deletedAt) {
      throw new BadRequestException('Dokumen nasabah sudah dihapus');
    }

    if (!this.isAdminOrSuperAdmin(user)) {
      const pegawaiRequester = await this.nasabahRepository.findPegawaiByUserId(
        user.userId,
      );

      if (pegawaiRequester?.id !== dokumen.nasabah.pegawaiId) {
        throw new ForbiddenException(
          'Anda tidak berhak menghapus dokumen nasabah ini',
        );
      }
    }

    try {
      await this.minioService.deleteObjectByStoredRef(dokumen.fileKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Gagal menghapus file MinIO untuk dokumen ${dokumenId}: ${message}`,
      );
    }

    await this.nasabahRepository.softDeleteNasabahDokumen(dokumenId);

    await this.auditTrailService.log({
      action: AuditAction.DELETE,
      entityName: 'NasabahDokumen',
      entityId: dokumenId,
      userId: user.userId,
      before: {
        nasabahId: dokumen.nasabahId,
        jenisDokumen: dokumen.jenisDokumen,
        fileKey: dokumen.fileKey,
        uploadedAt: dokumen.uploadedAt.toISOString(),
        deletedAt: null,
      },
      after: {
        deletedAt: new Date().toISOString(),
      },
      ipAddress,
    });

    return {
      message: 'Dokumen nasabah berhasil dihapus',
    };
  }

  private validateFile(
    file: UploadFile,
    allowedMime: string[],
    maxSizeMb: number,
  ) {
    const size = file.size || file.buffer.length;
    if (size > maxSizeMb * 1024 * 1024) {
      throw new BadRequestException(`Ukuran file melebihi ${maxSizeMb}MB`);
    }

    if (!allowedMime.includes(file.mimetype)) {
      throw new BadRequestException('Tipe file tidak sesuai ketentuan');
    }
  }

  async verifikasiNasabah(
    id: number,
    dto: VerifikasiNasabahDto,
    userId: number,
    ipAddress?: string,
  ) {
    const nasabah = await this.nasabahRepository.findNasabahById(id);
    if (!nasabah) {
      throw new NotFoundException('Nasabah tidak ditemukan');
    }

    if (
      dto.status !== NasabahStatus.AKTIF &&
      dto.status !== NasabahStatus.DITOLAK
    ) {
      throw new BadRequestException('Status verifikasi tidak valid');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await this.nasabahRepository.updateNasabahStatus(
        id,
        dto.status,
        dto.catatan,
        tx,
      );

      if (dto.status === NasabahStatus.AKTIF) {
        await this.ensureRekeningSimpanan(id, tx);
      }

      await this.auditTrailService.log(
        {
          action: AuditAction.UPDATE,
          entityName: 'Nasabah',
          entityId: id,
          userId,
          before: { status: nasabah.status, catatan: nasabah.catatan ?? null },
          after: { status: result.status, catatan: result.catatan ?? null },
          ipAddress,
        },
        tx,
      );

      return result;
    });

    return {
      message: 'Verifikasi nasabah berhasil',
      data: updated,
    };
  }

  async updateStatusNasabah(
    id: number,
    dto: UpdateNasabahStatusDto,
    userId: number,
    ipAddress?: string,
  ) {
    const nasabah = await this.nasabahRepository.findNasabahById(id);
    if (!nasabah) {
      throw new NotFoundException('Nasabah tidak ditemukan');
    }

    if (
      dto.status !== NasabahStatus.AKTIF &&
      dto.status !== NasabahStatus.NONAKTIF
    ) {
      throw new BadRequestException('Status keanggotaan tidak valid');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await this.nasabahRepository.updateNasabahStatus(
        id,
        dto.status,
        nasabah.catatan ?? undefined,
        tx,
      );

      if (dto.status === NasabahStatus.AKTIF) {
        await this.ensureRekeningSimpanan(id, tx);
      }

      await this.auditTrailService.log(
        {
          action: AuditAction.UPDATE,
          entityName: 'Nasabah',
          entityId: id,
          userId,
          before: { status: nasabah.status },
          after: { status: result.status },
          ipAddress,
        },
        tx,
      );

      return result;
    });

    return {
      message: 'Status nasabah berhasil diperbarui',
      data: updated,
    };
  }

  private async ensureRekeningSimpanan(
    nasabahId: number,
    tx?: Prisma.TransactionClient,
  ) {
    const jenisList = [
      JenisSimpanan.POKOK,
      JenisSimpanan.WAJIB,
      JenisSimpanan.SUKARELA,
    ];

    for (const jenis of jenisList) {
      const existing =
        await this.nasabahRepository.findRekeningSimpananByNasabahAndJenis(
          nasabahId,
          jenis,
        );
      if (!existing) {
        await this.nasabahRepository.createRekeningSimpanan(
          {
            nasabahId,
            jenisSimpanan: jenis,
            saldoBerjalan: 0,
          },
          tx,
        );
      }
    }
  }
}
