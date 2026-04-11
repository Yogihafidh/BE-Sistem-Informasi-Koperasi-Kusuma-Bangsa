import { Injectable } from '@nestjs/common';
import {
  JenisTransaksi,
  NasabahStatus,
  PinjamanStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';

@Injectable()
export class RekapitulasiRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // Membuat filter query transaksi berdasarkan tanggal & jenis
  private buildTransaksiWhere(args: {
    tanggalFrom?: Date;
    tanggalTo?: Date;
    tanggalLte?: Date;
    jenisTransaksi?: JenisTransaksi[];
  }): Prisma.TransaksiWhereInput {
    const where: Prisma.TransaksiWhereInput = { deletedAt: null };

    if (args.jenisTransaksi && args.jenisTransaksi.length > 0) {
      where.jenisTransaksi = { in: args.jenisTransaksi };
    }

    if (args.tanggalFrom || args.tanggalTo || args.tanggalLte) {
      where.tanggal = {
        ...(args.tanggalFrom ? { gte: args.tanggalFrom } : {}),
        ...(args.tanggalTo ? { lte: args.tanggalTo } : {}),
        ...(args.tanggalLte ? { lte: args.tanggalLte } : {}),
      };
    }

    return where;
  }

  // Mengambil jumlah & total nominal transaksi per jenis (dalam periode tertentu)
  groupTransaksiByJenis(args: { tanggalFrom: Date; tanggalTo: Date }) {
    return this.prisma.transaksi.groupBy({
      by: ['jenisTransaksi'],
      where: this.buildTransaksiWhere({
        tanggalFrom: args.tanggalFrom,
        tanggalTo: args.tanggalTo,
      }),
      _count: { _all: true },
      _sum: { nominal: true },
    });
  }

  // Mengambil total nominal transaksi per jenis sampai tanggal tertentu (kumulatif)
  groupTransaksiByJenisUntil(tanggalLte: Date) {
    return this.prisma.transaksi.groupBy({
      by: ['jenisTransaksi'],
      where: this.buildTransaksiWhere({
        tanggalLte,
      }),
      _sum: { nominal: true },
    });
  }

  // Mengambil jumlah nasabah unik yang melakukan transaksi dalam periode tertentu
  countDistinctNasabahTransaksi(args: { tanggalFrom: Date; tanggalTo: Date }) {
    return this.prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(DISTINCT "nasabahId") AS count
        FROM "Transaksi"
        WHERE "deletedAt" IS NULL
          AND "tanggal" >= ${args.tanggalFrom}
          AND "tanggal" <= ${args.tanggalTo}
      `,
    );
  }

  // Mengambil total saldo simpanan per jenis (pokok, wajib, sukarela)
  groupSaldoSimpananByJenis() {
    return this.prisma.rekeningSimpanan.groupBy({
      by: ['jenisSimpanan'],
      where: { deletedAt: null },
      _sum: { saldoBerjalan: true },
    });
  }

  // Mengambil total saldo simpanan per jenis pada waktu tertentu
  groupSaldoSimpananByJenisAt(tanggalLte: Date) {
    return this.prisma.rekeningSimpanan.groupBy({
      by: ['jenisSimpanan'],
      where: {
        OR: [{ deletedAt: null }, { deletedAt: { gt: tanggalLte } }],
      },
      _sum: { saldoBerjalan: true },
    });
  }

  // Mengambil total sisa pinjaman aktif dan jumlah pinjaman aktif
  getOutstandingPinjamanSummary() {
    return this.prisma.pinjaman.aggregate({
      where: {
        deletedAt: null,
        status: { in: [PinjamanStatus.DISETUJUI, PinjamanStatus.TERLAMBAT] },
        sisaPinjaman: { gt: new Prisma.Decimal(0) },
      },
      _sum: { sisaPinjaman: true },
      _count: { _all: true },
    });
  }

  // Mengambil total sisa pinjaman aktif pada waktu tertentu
  getOutstandingPinjamanSummaryAt(tanggalLte: Date) {
    return this.prisma.pinjaman.aggregate({
      where: {
        status: { in: [PinjamanStatus.DISETUJUI, PinjamanStatus.TERLAMBAT] },
        sisaPinjaman: { gt: new Prisma.Decimal(0) },
        AND: [
          {
            OR: [{ deletedAt: null }, { deletedAt: { gt: tanggalLte } }],
          },
          {
            OR: [
              { tanggalPersetujuan: null },
              { tanggalPersetujuan: { lte: tanggalLte } },
            ],
          },
        ],
      },
      _sum: { sisaPinjaman: true },
      _count: { _all: true },
    });
  }

  // Mengambil jumlah nasabah yang memiliki pinjaman aktif
  countDistinctNasabahPinjamanAktif() {
    return this.prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(DISTINCT "nasabahId") AS count
        FROM "Pinjaman"
        WHERE "deletedAt" IS NULL
          AND "status" IN (
            ${PinjamanStatus.DISETUJUI}::"PinjamanStatus",
            ${PinjamanStatus.TERLAMBAT}::"PinjamanStatus"
          )
          AND "sisaPinjaman" > 0
      `,
    );
  }

  // Mengambil jumlah nasabah yang memiliki pinjaman aktif pada waktu tertentu
  countDistinctNasabahPinjamanAktifAt(tanggalLte: Date) {
    return this.prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(DISTINCT "nasabahId") AS count
        FROM "Pinjaman"
        WHERE ("deletedAt" IS NULL OR "deletedAt" > ${tanggalLte})
          AND "status" IN (
            ${PinjamanStatus.DISETUJUI}::"PinjamanStatus",
            ${PinjamanStatus.TERLAMBAT}::"PinjamanStatus"
          )
          AND "sisaPinjaman" > 0
          AND ("tanggalPersetujuan" IS NULL OR "tanggalPersetujuan" <= ${tanggalLte})
      `,
    );
  }

  // Mengambil jumlah seluruh nasabah terdaftar
  countNasabahTotal() {
    return this.prisma.nasabah.count({
      where: { deletedAt: null },
    });
  }

  // Mengambil jumlah nasabah sampai waktu tertentu
  countNasabahTotalAt(tanggalLte: Date) {
    return this.prisma.nasabah.count({
      where: {
        tanggalDaftar: { lte: tanggalLte },
        OR: [{ deletedAt: null }, { deletedAt: { gt: tanggalLte } }],
      },
    });
  }

  // Mengambil jumlah nasabah dengan status AKTIF
  countNasabahAktifAt(tanggalLte: Date) {
    return this.prisma.nasabah.count({
      where: {
        status: NasabahStatus.AKTIF,
        tanggalDaftar: { lte: tanggalLte },
        OR: [{ deletedAt: null }, { deletedAt: { gt: tanggalLte } }],
      },
    });
  }

  // Mengambil jumlah nasabah baru dalam periode tertentu
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

  // Mengambil jumlah nasabah yang keluar (NONAKTIF) dalam periode tertentu
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
}
