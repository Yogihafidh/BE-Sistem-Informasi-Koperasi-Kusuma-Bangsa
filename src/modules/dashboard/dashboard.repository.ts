import { Injectable } from '@nestjs/common';
import {
  NasabahStatus,
  JenisTransaksi,
  PinjamanStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private monthStart(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  private nextMonthStart(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  }

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

  countTransaksi(args: { tanggalFrom?: Date; tanggalTo?: Date }) {
    return this.prisma.transaksi.count({
      where: this.buildTransaksiWhere({
        tanggalFrom: args.tanggalFrom,
        tanggalTo: args.tanggalTo,
      }),
    });
  }

  groupTransaksiByJenis(args: { tanggalFrom: Date; tanggalTo: Date }) {
    return this.prisma.transaksi.groupBy({
      by: ['jenisTransaksi'],
      where: this.buildTransaksiWhere({
        tanggalFrom: args.tanggalFrom,
        tanggalTo: args.tanggalTo,
      }),
      _sum: { nominal: true },
    });
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

  // Menghitung total saldo simpanan dengan menjumlahkan saldoBerjalan dari semua rekening simpanan yang masih aktif (deletedAt = null)
  sumSaldoSimpanan() {
    return this.prisma.rekeningSimpanan.aggregate({
      where: { deletedAt: null },
      _sum: { saldoBerjalan: true },
    });
  }

  // Menghitung total sisa pinjaman untuk semua pinjaman yang masih aktif (status DISETUJUI dan sisaPinjaman > 0)
  groupSaldoSimpananByJenis() {
    return this.prisma.rekeningSimpanan.groupBy({
      by: ['jenisSimpanan'],
      where: { deletedAt: null },
      _sum: { saldoBerjalan: true },
    });
  }

  // Hitung total sisa pinjaman untuk semua pinjaman yang masih aktif (status DISETUJUI dan sisaPinjaman > 0)
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

  // Ambil daftar N pinjaman dengan sisa
  listTopOutstandingPinjaman(take: number) {
    return this.prisma.pinjaman.findMany({
      where: {
        // Ambil data pinjaman
        deletedAt: null,
        status: PinjamanStatus.DISETUJUI,
        sisaPinjaman: { gt: new Prisma.Decimal(0) },
        nasabah: {
          deletedAt: null,
        },
      },
      select: {
        // Join with nasabah
        id: true,
        sisaPinjaman: true,
        nasabah: {
          select: {
            nama: true,
          },
        },
      },
      orderBy: { sisaPinjaman: 'desc' }, // Urutkan terbesar
      take, // Ambil N teratas
    });
  }

  // Menghitung jumlah total nasabah (termasuk yang nonaktif)
  countNasabahTotal() {
    return this.prisma.nasabah.count({ where: { deletedAt: null } });
  }

  // Menghitung jumlah nasabah yang masih aktif (status AKTIF)
  countNasabahAktif() {
    return this.prisma.nasabah.count({
      where: {
        deletedAt: null,
        status: NasabahStatus.AKTIF,
      },
    });
  }

  // Menghitung jumlah nasabah yang baru mendaftar dalam rentang waktu tertentu
  countNasabahBaru(args: { tanggalFrom: Date; tanggalTo: Date }) {
    return this.prisma.nasabah.count({
      where: {
        deletedAt: null,
        tanggalDaftar: {
          gte: args.tanggalFrom,
          lte: args.tanggalTo,
        },
      },
    });
  }

  // Menghitung jumlah nasabah yang keluar (nonaktif) dalam rentang waktu tertentu
  countNasabahKeluar(args: { tanggalFrom: Date; tanggalTo: Date }) {
    return this.prisma.nasabah.count({
      where: {
        deletedAt: null,
        status: NasabahStatus.NONAKTIF,
        updatedAt: {
          gte: args.tanggalFrom,
          lte: args.tanggalTo,
        },
      },
    });
  }

  // Menghitung jumlah nasabah berdasarkan kondisi tertentu
  countNasabah(where: Prisma.NasabahWhereInput) {
    return this.prisma.nasabah.count({ where });
  }

  // Dapatkan cashflow masuk/keluar per bulan
  getCashflowTrend(args: { startMonth: Date; endMonth: Date }) {
    // Tentukan Range Waktu
    const start = this.monthStart(args.startMonth);
    const endExclusive = this.nextMonthStart(args.endMonth);

    // Query dengan grouping berdasarkan bulan, lalu hitung total kas masuk dan keluar per bulan
    return this.prisma.$queryRaw<
      Array<{
        year: number;
        month: number;
        kasMasuk: Prisma.Decimal | null;
        kasKeluar: Prisma.Decimal | null;
      }>
    >(
      Prisma.sql`
        SELECT
          EXTRACT(YEAR FROM date_trunc('month', "tanggal"))::int AS year,
          EXTRACT(MONTH FROM date_trunc('month', "tanggal"))::int AS month,
          SUM(
            CASE
              WHEN "jenisTransaksi" IN (
                ${JenisTransaksi.SETORAN}::"JenisTransaksi",
                ${JenisTransaksi.ANGSURAN}::"JenisTransaksi"
              ) THEN "nominal"
              ELSE 0
            END
          ) AS "kasMasuk",
          SUM(
            CASE
              WHEN "jenisTransaksi" IN (
                ${JenisTransaksi.PENARIKAN}::"JenisTransaksi",
                ${JenisTransaksi.PENCAIRAN}::"JenisTransaksi"
              ) THEN "nominal"
              ELSE 0
            END
          ) AS "kasKeluar"
        FROM "Transaksi"
        WHERE "deletedAt" IS NULL
          AND "tanggal" >= ${start}
          AND "tanggal" < ${endExclusive}
        GROUP BY date_trunc('month', "tanggal")
        ORDER BY date_trunc('month', "tanggal") ASC
      `,
    );
  }

  // Dapatkan tren keanggotaan (anggota baru dan keluar) per bulan
  getKeanggotaanTrend(args: { startMonth: Date; endMonth: Date }) {
    const start = this.monthStart(args.startMonth);
    const endExclusive = this.nextMonthStart(args.endMonth);

    return this.prisma.$queryRaw<
      Array<{
        year: number;
        month: number;
        anggotaBaru: bigint;
        anggotaKeluar: bigint;
      }>
    >(
      Prisma.sql`
        WITH anggota_baru AS (
          SELECT
            date_trunc('month', "tanggalDaftar") AS m,
            COUNT(*)::bigint AS anggota_baru
          FROM "Nasabah"
          WHERE "deletedAt" IS NULL
            AND "tanggalDaftar" >= ${start}
            AND "tanggalDaftar" < ${endExclusive}
          GROUP BY date_trunc('month', "tanggalDaftar")
        ),
        anggota_keluar AS (
          SELECT
            date_trunc('month', "updatedAt") AS m,
            COUNT(*)::bigint AS anggota_keluar
          FROM "Nasabah"
          WHERE "deletedAt" IS NULL
            AND "status" = ${NasabahStatus.NONAKTIF}::"NasabahStatus"
            AND "updatedAt" >= ${start}
            AND "updatedAt" < ${endExclusive}
          GROUP BY date_trunc('month', "updatedAt")
        )
        SELECT
          EXTRACT(YEAR FROM COALESCE(b.m, k.m))::int AS year,
          EXTRACT(MONTH FROM COALESCE(b.m, k.m))::int AS month,
          COALESCE(b.anggota_baru, 0)::bigint AS "anggotaBaru",
          COALESCE(k.anggota_keluar, 0)::bigint AS "anggotaKeluar"
        FROM anggota_baru b
        FULL OUTER JOIN anggota_keluar k ON b.m = k.m
        ORDER BY COALESCE(b.m, k.m) ASC
      `,
    );
  }
}
