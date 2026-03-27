import { Injectable } from '@nestjs/common';
import {
  JenisSimpanan,
  JenisTransaksi,
  NasabahStatus,
  PinjamanStatus,
  Prisma,
  PrismaClient,
  StatusLaporan,
} from '@prisma/client';

@Injectable()
export class LaporanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private buildTransaksiWhere(args: {
    jenisTransaksi?: JenisTransaksi | JenisTransaksi[];
    tanggalFrom?: Date;
    tanggalTo?: Date;
  }): Prisma.TransaksiWhereInput {
    const where: Prisma.TransaksiWhereInput = {
      deletedAt: null,
    };

    if (args.jenisTransaksi) {
      if (Array.isArray(args.jenisTransaksi)) {
        where.jenisTransaksi = { in: args.jenisTransaksi };
      } else {
        where.jenisTransaksi = args.jenisTransaksi;
      }
    }

    if (args.tanggalFrom || args.tanggalTo) {
      where.tanggal = {
        ...(args.tanggalFrom ? { gte: args.tanggalFrom } : {}),
        ...(args.tanggalTo ? { lte: args.tanggalTo } : {}),
      };
    }

    return where;
  }

  sumTransaksiNominal(args: {
    jenisTransaksi?: JenisTransaksi | JenisTransaksi[];
    tanggalFrom?: Date;
    tanggalTo?: Date;
  }) {
    return this.prisma.transaksi.aggregate({
      where: this.buildTransaksiWhere(args),
      _sum: {
        nominal: true,
      },
    });
  }

  countTransaksi(args: {
    jenisTransaksi?: JenisTransaksi | JenisTransaksi[];
    tanggalFrom?: Date;
    tanggalTo?: Date;
  }) {
    return this.prisma.transaksi.aggregate({
      where: this.buildTransaksiWhere(args),
      _count: { _all: true },
    });
  }

  groupTransaksiByJenis(args: { tanggalFrom?: Date; tanggalTo?: Date }) {
    return this.prisma.transaksi.groupBy({
      by: ['jenisTransaksi'],
      where: this.buildTransaksiWhere(args),
      _count: { _all: true },
      _sum: { nominal: true },
    });
  }

  async getTransaksiSummaryByJenis(args: {
    tanggalFrom?: Date;
    tanggalTo?: Date;
  }) {
    const conditions: Prisma.Sql[] = [Prisma.sql`"deletedAt" IS NULL`];

    if (args.tanggalFrom) {
      conditions.push(Prisma.sql`"tanggal" >= ${args.tanggalFrom}`);
    }

    if (args.tanggalTo) {
      conditions.push(Prisma.sql`"tanggal" <= ${args.tanggalTo}`);
    }

    const whereSql = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

    return this.prisma.$queryRaw<
      Array<{
        jenisTransaksi: JenisTransaksi;
        jumlah: bigint;
        total: Prisma.Decimal | null;
        total_count: bigint;
        total_nominal: Prisma.Decimal | null;
      }>
    >(
      Prisma.sql`
        SELECT
          "jenisTransaksi",
          COUNT(*) AS jumlah,
          SUM("nominal") AS total,
          SUM(COUNT(*)) OVER () AS total_count,
          SUM(SUM("nominal")) OVER () AS total_nominal
        FROM "Transaksi"
        ${whereSql}
        GROUP BY "jenisTransaksi"
      `,
    );
  }

  async getCashflowMonthlySummary(args: {
    tanggalFrom: Date;
    tanggalTo: Date;
  }) {
    const pemasukanJenis = [JenisTransaksi.SETORAN, JenisTransaksi.ANGSURAN];
    const pengeluaranJenis = [
      JenisTransaksi.PENARIKAN,
      JenisTransaksi.PENCAIRAN,
    ];
    const pemasukanJenisSql = pemasukanJenis.map(
      (jenis) => Prisma.sql`${jenis}::"JenisTransaksi"`,
    );
    const pengeluaranJenisSql = pengeluaranJenis.map(
      (jenis) => Prisma.sql`${jenis}::"JenisTransaksi"`,
    );

    return this.prisma.$queryRaw<
      Array<{
        tahun: number;
        bulan: number;
        pemasukan: Prisma.Decimal | null;
        pengeluaran: Prisma.Decimal | null;
      }>
    >(
      Prisma.sql`
        SELECT
          EXTRACT(YEAR FROM "tanggal")::int AS tahun,
          EXTRACT(MONTH FROM "tanggal")::int AS bulan,
          SUM(
            CASE
              WHEN "jenisTransaksi" IN (${Prisma.join(pemasukanJenisSql)})
                THEN "nominal"
              ELSE 0
            END
          ) AS pemasukan,
          SUM(
            CASE
              WHEN "jenisTransaksi" IN (${Prisma.join(pengeluaranJenisSql)})
                THEN "nominal"
              ELSE 0
            END
          ) AS pengeluaran
        FROM "Transaksi"
        WHERE "deletedAt" IS NULL
          AND "tanggal" >= ${args.tanggalFrom}
          AND "tanggal" <= ${args.tanggalTo}
        GROUP BY tahun, bulan
      `,
    );
  }

  topNasabahByTransaksi(args: {
    jenisTransaksi: JenisTransaksi;
    tanggalFrom?: Date;
    tanggalTo?: Date;
    take?: number;
  }) {
    return this.prisma.transaksi.groupBy({
      by: ['nasabahId'],
      where: this.buildTransaksiWhere({
        jenisTransaksi: args.jenisTransaksi,
        tanggalFrom: args.tanggalFrom,
        tanggalTo: args.tanggalTo,
      }),
      _count: { _all: true },
      orderBy: {
        _count: { nasabahId: 'desc' },
      },
      take: args.take ?? 1,
    });
  }

  topNasabahByNominal(args: {
    jenisTransaksi: JenisTransaksi | JenisTransaksi[];
    tanggalFrom?: Date;
    tanggalTo?: Date;
    take?: number;
  }) {
    return this.prisma.transaksi.groupBy({
      by: ['nasabahId'],
      where: this.buildTransaksiWhere({
        jenisTransaksi: args.jenisTransaksi,
        tanggalFrom: args.tanggalFrom,
        tanggalTo: args.tanggalTo,
      }),
      _sum: { nominal: true },
      orderBy: {
        _sum: { nominal: 'desc' },
      },
      take: args.take ?? 1,
    });
  }

  findNasabahByIds(ids: number[]) {
    return this.prisma.nasabah.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, nama: true, nomorAnggota: true },
    });
  }

  countPinjamanAktif() {
    return this.prisma.pinjaman.count({
      where: {
        deletedAt: null,
        status: PinjamanStatus.DISETUJUI,
        sisaPinjaman: { gt: new Prisma.Decimal(0) },
      },
    });
  }

  sumPinjamanAktifNominal() {
    return this.prisma.pinjaman.aggregate({
      where: {
        deletedAt: null,
        status: PinjamanStatus.DISETUJUI,
        sisaPinjaman: { gt: new Prisma.Decimal(0) },
      },
      _sum: { sisaPinjaman: true },
    });
  }

  listTopOutstandingPinjaman(take: number) {
    return this.prisma.pinjaman.findMany({
      where: {
        deletedAt: null,
        status: PinjamanStatus.DISETUJUI,
        sisaPinjaman: { gt: new Prisma.Decimal(0) },
      },
      select: { sisaPinjaman: true },
      orderBy: { sisaPinjaman: 'desc' },
      take,
    });
  }

  aggregatePinjamanPeriode(args: { tanggalFrom: Date; tanggalTo: Date }) {
    return this.prisma.pinjaman.aggregate({
      where: {
        deletedAt: null,
        status: { in: [PinjamanStatus.DISETUJUI, PinjamanStatus.LUNAS] },
        tanggalPersetujuan: {
          gte: args.tanggalFrom,
          lte: args.tanggalTo,
        },
      },
      _sum: { jumlahPinjaman: true },
      _min: { jumlahPinjaman: true },
      _max: { jumlahPinjaman: true },
      _avg: { bungaPersen: true },
    });
  }

  countPinjamanBaru(args: { tanggalFrom: Date; tanggalTo: Date }) {
    return this.prisma.pinjaman.count({
      where: {
        deletedAt: null,
        status: { in: [PinjamanStatus.DISETUJUI, PinjamanStatus.LUNAS] },
        tanggalPersetujuan: {
          gte: args.tanggalFrom,
          lte: args.tanggalTo,
        },
      },
    });
  }

  groupPinjamanTenor(args: { tanggalFrom: Date; tanggalTo: Date }) {
    return this.prisma.pinjaman.groupBy({
      by: ['tenorBulan'],
      where: {
        deletedAt: null,
        status: PinjamanStatus.DISETUJUI,
        tanggalPersetujuan: {
          gte: args.tanggalFrom,
          lte: args.tanggalTo,
        },
      },
      _count: { _all: true },
      orderBy: {
        _count: { tenorBulan: 'desc' },
      },
      take: 1,
    });
  }

  async countAngsuranLunasInPeriod(args: {
    tanggalFrom: Date;
    tanggalTo: Date;
  }) {
    const grouped = await this.prisma.transaksi.groupBy({
      where: {
        deletedAt: null,
        jenisTransaksi: JenisTransaksi.ANGSURAN,
        tanggal: {
          gte: args.tanggalFrom,
          lte: args.tanggalTo,
        },
        pinjaman: {
          status: PinjamanStatus.LUNAS,
        },
      },
      by: ['pinjamanId'],
      _count: { _all: true },
    });

    return grouped.length;
  }

  async countDistinctNasabahTransaksi(args: {
    jenisTransaksi?: JenisTransaksi | JenisTransaksi[];
    tanggalFrom?: Date;
    tanggalTo?: Date;
  }) {
    const conditions: Prisma.Sql[] = [Prisma.sql`"deletedAt" IS NULL`];

    if (args.jenisTransaksi) {
      const jenisList = Array.isArray(args.jenisTransaksi)
        ? args.jenisTransaksi
        : [args.jenisTransaksi];
      const jenisListSql = jenisList.map(
        (jenis) => Prisma.sql`${jenis}::"JenisTransaksi"`,
      );
      conditions.push(
        Prisma.sql`"jenisTransaksi" IN (${Prisma.join(jenisListSql)})`,
      );
    }

    if (args.tanggalFrom) {
      conditions.push(Prisma.sql`"tanggal" >= ${args.tanggalFrom}`);
    }

    if (args.tanggalTo) {
      conditions.push(Prisma.sql`"tanggal" <= ${args.tanggalTo}`);
    }

    const whereSql = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;

    const result = await this.prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(DISTINCT "nasabahId") AS count
        FROM "Transaksi"
        ${whereSql}
      `,
    );

    return Number(result[0]?.count ?? 0);
  }

  topNasabahBySaldoSimpanan(take: number) {
    return this.prisma.rekeningSimpanan.groupBy({
      by: ['nasabahId'],
      where: { deletedAt: null },
      _sum: { saldoBerjalan: true },
      orderBy: {
        _sum: { saldoBerjalan: 'desc' },
      },
      take,
    });
  }

  groupSaldoSimpananByJenis() {
    return this.prisma.rekeningSimpanan.groupBy({
      by: ['jenisSimpanan'],
      where: { deletedAt: null },
      _sum: { saldoBerjalan: true },
    });
  }

  sumSaldoSimpanan() {
    return this.prisma.rekeningSimpanan.aggregate({
      where: { deletedAt: null },
      _sum: { saldoBerjalan: true },
    });
  }

  countRekeningWajibBelumSetor(args: { tanggalFrom: Date; tanggalTo: Date }) {
    return this.prisma.rekeningSimpanan.count({
      where: {
        deletedAt: null,
        jenisSimpanan: JenisSimpanan.WAJIB,
        transaksi: {
          none: {
            deletedAt: null,
            jenisTransaksi: JenisTransaksi.SETORAN,
            tanggal: {
              gte: args.tanggalFrom,
              lte: args.tanggalTo,
            },
          },
        },
      },
    });
  }

  maxSaldoSimpanan() {
    return this.prisma.rekeningSimpanan.aggregate({
      where: { deletedAt: null },
      _max: { saldoBerjalan: true },
    });
  }

  countRekeningSaldoKecil(threshold: number) {
    return this.prisma.rekeningSimpanan.count({
      where: {
        deletedAt: null,
        saldoBerjalan: { lt: threshold },
      },
    });
  }

  countNasabah(where: Prisma.NasabahWhereInput) {
    return this.prisma.nasabah.count({ where });
  }

  async countNasabahAktifTidakTransaksiSejak(args: { threshold: Date }) {
    const result = await this.prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(*) AS count
        FROM "Nasabah" n
        LEFT JOIN (
          SELECT "nasabahId", MAX("tanggal") AS last_trx
          FROM "Transaksi"
          WHERE "deletedAt" IS NULL
          GROUP BY "nasabahId"
        ) t ON t."nasabahId" = n."id"
        WHERE n."deletedAt" IS NULL
          AND n."status" = ${NasabahStatus.AKTIF}
          AND (t.last_trx IS NULL OR t.last_trx <= ${args.threshold})
      `,
    );

    return Number(result[0]?.count ?? 0);
  }

  async countNasabahWithPinjamanAktif() {
    const grouped = await this.prisma.pinjaman.groupBy({
      where: {
        deletedAt: null,
        status: PinjamanStatus.DISETUJUI,
        sisaPinjaman: { gt: new Prisma.Decimal(0) },
        nasabah: { deletedAt: null },
      },
      by: ['nasabahId'],
      _count: { _all: true },
    });

    return grouped.length;
  }

  findLaporanKeuanganByPeriode(bulan: number, tahun: number) {
    return this.prisma.laporanKeuangan.findFirst({
      where: { periodeBulan: bulan, periodeTahun: tahun },
    });
  }

  findLatestLaporanKeuangan() {
    return this.prisma.laporanKeuangan.findFirst({
      orderBy: [{ periodeTahun: 'desc' }, { periodeBulan: 'desc' }],
    });
  }

  findPreviousFinalLaporan(bulan: number, tahun: number) {
    return this.prisma.laporanKeuangan.findFirst({
      where: {
        statusLaporan: StatusLaporan.FINAL,
        OR: [
          { periodeTahun: { lt: tahun } },
          { periodeTahun: tahun, periodeBulan: { lt: bulan } },
        ],
      },
      orderBy: [{ periodeTahun: 'desc' }, { periodeBulan: 'desc' }],
    });
  }

  createLaporanKeuangan(data: {
    periodeBulan: number;
    periodeTahun: number;
    totalSimpanan: number;
    totalPenarikan: number;
    totalPinjaman: number;
    totalAngsuran: number;
    saldoAkhir: number;
    statusLaporan: StatusLaporan;
    generatedById: number;
    generatedAt: Date;
  }) {
    return this.prisma.laporanKeuangan.create({ data });
  }

  updateLaporanKeuangan(
    id: number,
    data: {
      totalSimpanan: number;
      totalPenarikan: number;
      totalPinjaman: number;
      totalAngsuran: number;
      saldoAkhir: number;
      generatedAt: Date;
    },
  ) {
    return this.prisma.laporanKeuangan.update({ where: { id }, data });
  }

  updateLaporanStatus(id: number, status: StatusLaporan) {
    return this.prisma.laporanKeuangan.update({
      where: { id },
      data: { statusLaporan: status },
    });
  }

  findLaporanKeuanganById(id: number) {
    return this.prisma.laporanKeuangan.findUnique({ where: { id } });
  }
}
