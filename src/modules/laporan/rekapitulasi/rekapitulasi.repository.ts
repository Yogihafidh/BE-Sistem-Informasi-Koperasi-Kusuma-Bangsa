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

  groupTransaksiByJenisUntil(tanggalLte: Date) {
    return this.prisma.transaksi.groupBy({
      by: ['jenisTransaksi'],
      where: this.buildTransaksiWhere({
        tanggalLte,
      }),
      _sum: { nominal: true },
    });
  }

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

  groupSaldoSimpananByJenis() {
    return this.prisma.rekeningSimpanan.groupBy({
      by: ['jenisSimpanan'],
      where: { deletedAt: null },
      _sum: { saldoBerjalan: true },
    });
  }

  groupSaldoSimpananByJenisAt(tanggalLte: Date) {
    return this.prisma.rekeningSimpanan.groupBy({
      by: ['jenisSimpanan'],
      where: {
        OR: [{ deletedAt: null }, { deletedAt: { gt: tanggalLte } }],
      },
      _sum: { saldoBerjalan: true },
    });
  }

  getOutstandingPinjamanSummary() {
    return this.prisma.pinjaman.aggregate({
      where: {
        deletedAt: null,
        status: PinjamanStatus.DISETUJUI,
        sisaPinjaman: { gt: new Prisma.Decimal(0) },
      },
      _sum: { sisaPinjaman: true },
      _count: { _all: true },
    });
  }

  getOutstandingPinjamanSummaryAt(tanggalLte: Date) {
    return this.prisma.pinjaman.aggregate({
      where: {
        status: PinjamanStatus.DISETUJUI,
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

  countDistinctNasabahPinjamanAktif() {
    return this.prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(DISTINCT "nasabahId") AS count
        FROM "Pinjaman"
        WHERE "deletedAt" IS NULL
          AND "status" = ${PinjamanStatus.DISETUJUI}::"PinjamanStatus"
          AND "sisaPinjaman" > 0
      `,
    );
  }

  countDistinctNasabahPinjamanAktifAt(tanggalLte: Date) {
    return this.prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(DISTINCT "nasabahId") AS count
        FROM "Pinjaman"
        WHERE ("deletedAt" IS NULL OR "deletedAt" > ${tanggalLte})
          AND "status" = ${PinjamanStatus.DISETUJUI}::"PinjamanStatus"
          AND "sisaPinjaman" > 0
          AND ("tanggalPersetujuan" IS NULL OR "tanggalPersetujuan" <= ${tanggalLte})
      `,
    );
  }

  countNasabahTotal() {
    return this.prisma.nasabah.count({
      where: { deletedAt: null },
    });
  }

  countNasabahTotalAt(tanggalLte: Date) {
    return this.prisma.nasabah.count({
      where: {
        tanggalDaftar: { lte: tanggalLte },
        OR: [{ deletedAt: null }, { deletedAt: { gt: tanggalLte } }],
      },
    });
  }

  countNasabahAktifAt(tanggalLte: Date) {
    return this.prisma.nasabah.count({
      where: {
        status: NasabahStatus.AKTIF,
        tanggalDaftar: { lte: tanggalLte },
        OR: [{ deletedAt: null }, { deletedAt: { gt: tanggalLte } }],
      },
    });
  }

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
