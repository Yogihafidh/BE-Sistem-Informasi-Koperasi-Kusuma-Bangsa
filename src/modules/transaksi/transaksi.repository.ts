import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient, JenisTransaksi } from '@prisma/client';

const TRANSAKSI_SUMMARY_SELECT = {
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
} satisfies Prisma.TransaksiSelect;

@Injectable()
export class TransaksiRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private readonly transaksiSummarySelect = TRANSAKSI_SUMMARY_SELECT;

  findPegawaiByUserId(userId: number) {
    return this.prisma.pegawai.findUnique({
      where: { userId },
      select: {
        id: true,
        nama: true,
        jabatan: true,
        userId: true,
        statusAktif: true,
      },
    });
  }

  findNasabahById(id: number) {
    return this.prisma.nasabah.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        status: true,
      },
    });
  }

  sumNominalByNasabahPerTanggal(args: {
    nasabahId: number;
    tanggalFrom: Date;
    tanggalTo: Date;
  }) {
    return this.prisma.transaksi.aggregate({
      where: {
        deletedAt: null,
        nasabahId: args.nasabahId,
        tanggal: {
          gte: args.tanggalFrom,
          lte: args.tanggalTo,
        },
      },
      _sum: {
        nominal: true,
      },
    });
  }

  findRekeningSimpananById(id: number, nasabahId: number) {
    return this.prisma.rekeningSimpanan.findFirst({
      where: { id, nasabahId, deletedAt: null },
    });
  }

  findPinjamanById(id: number, nasabahId: number) {
    return this.prisma.pinjaman.findFirst({
      where: { id, nasabahId, deletedAt: null },
    });
  }

  findPinjamanByIdOnly(id: number) {
    return this.prisma.pinjaman.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
      },
    });
  }

  findTransaksiSummaryById(id: number) {
    return this.prisma.transaksi.findFirst({
      where: { id, deletedAt: null },
      select: this.transaksiSummarySelect,
    });
  }

  softDeleteTransaksi(id: number) {
    return this.prisma.transaksi.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: this.transaksiSummarySelect,
    });
  }

  private async findTransaksiList(args: {
    cursor?: number;
    take: number;
    where: Record<string, unknown>;
  }) {
    const data = await this.prisma.transaksi.findMany({
      where: { deletedAt: null, ...args.where },
      select: this.transaksiSummarySelect,
      orderBy: { id: 'desc' },
      take: args.take + 1,
      ...(args.cursor
        ? {
            cursor: { id: args.cursor },
            skip: 1,
          }
        : {}),
    });

    let nextCursor: number | null = null;
    if (data.length > args.take) {
      const nextItem = data.pop();
      nextCursor = nextItem?.id ?? null;
    }

    return { data, nextCursor };
  }

  listTransaksi(args: {
    cursor?: number;
    take: number;
    jenisTransaksi?: JenisTransaksi;
    tanggalFrom?: Date;
    tanggalTo?: Date;
  }) {
    const where: Record<string, unknown> = {};
    if (args.jenisTransaksi) {
      where.jenisTransaksi = args.jenisTransaksi;
    }
    if (args.tanggalFrom || args.tanggalTo) {
      where.tanggal = {
        ...(args.tanggalFrom ? { gte: args.tanggalFrom } : {}),
        ...(args.tanggalTo ? { lte: args.tanggalTo } : {}),
      };
    }

    return this.findTransaksiList({
      cursor: args.cursor,
      take: args.take,
      where,
    });
  }

  listTransaksiByNasabah(args: {
    nasabahId: number;
    cursor?: number;
    take: number;
  }) {
    return this.findTransaksiList({
      cursor: args.cursor,
      take: args.take,
      where: { nasabahId: args.nasabahId },
    });
  }

  listTransaksiByPegawai(args: {
    pegawaiId: number;
    cursor?: number;
    take: number;
  }) {
    return this.findTransaksiList({
      cursor: args.cursor,
      take: args.take,
      where: { pegawaiId: args.pegawaiId },
    });
  }

  listTransaksiByRekening(args: {
    rekeningSimpananId: number;
    cursor?: number;
    take: number;
  }) {
    return this.findTransaksiList({
      cursor: args.cursor,
      take: args.take,
      where: { rekeningSimpananId: args.rekeningSimpananId },
    });
  }

  listTransaksiByPinjaman(args: {
    pinjamanId: number;
    cursor?: number;
    take: number;
  }) {
    return this.findTransaksiList({
      cursor: args.cursor,
      take: args.take,
      where: { pinjamanId: args.pinjamanId },
    });
  }
}
