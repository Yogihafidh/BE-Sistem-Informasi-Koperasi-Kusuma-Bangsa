import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient, JenisTransaksi } from '@prisma/client';
import {
  CursorPageRequest,
  CursorPageResult,
} from '../../common/types/pagination.type';

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

const TRANSAKSI_DETAIL_SELECT = {
  ...TRANSAKSI_SUMMARY_SELECT,
  nasabah: {
    select: {
      id: true,
      nomorAnggota: true,
      nama: true,
      pekerjaan: true,
    },
  },
  pegawai: {
    select: {
      id: true,
      nama: true,
      jabatan: true,
    },
  },
  rekeningSimpanan: {
    select: {
      id: true,
      jenisSimpanan: true,
    },
  },
  pinjaman: {
    select: {
      id: true,
      jumlahPinjaman: true,
      sisaPinjaman: true,
    },
  },
} satisfies Prisma.TransaksiSelect;

@Injectable()
export class TransaksiRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private readonly transaksiSummarySelect = TRANSAKSI_SUMMARY_SELECT;
  private readonly transaksiDetailSelect = TRANSAKSI_DETAIL_SELECT;

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

  findPegawaiById(id: number) {
    return this.prisma.pegawai.findFirst({
      where: { id },
      select: {
        id: true,
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

  findRekeningSimpananByIdOnly(id: number) {
    return this.prisma.rekeningSimpanan.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
      },
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

  findTransaksiDetailById(id: number) {
    return this.prisma.transaksi.findFirst({
      where: { id, deletedAt: null },
      select: this.transaksiDetailSelect,
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
    page: CursorPageRequest;
    where: Record<string, unknown>;
  }): Promise<
    CursorPageResult<
      Prisma.TransaksiGetPayload<{ select: typeof TRANSAKSI_SUMMARY_SELECT }>
    >
  > {
    const isBackward = typeof args.page.before === 'number';
    const baseWhere = { deletedAt: null, ...args.where };

    const data = await this.prisma.transaksi.findMany({
      where: {
        ...baseWhere,
        ...(typeof args.page.after === 'number'
          ? { id: { lt: args.page.after } }
          : {}),
        ...(typeof args.page.before === 'number'
          ? { id: { gt: args.page.before } }
          : {}),
      },
      select: this.transaksiSummarySelect,
      orderBy: { id: isBackward ? 'asc' : 'desc' },
      take: args.page.take,
    });

    const rows = isBackward ? [...data].reverse() : data;

    if (rows.length === 0) {
      return {
        data: rows,
        nextCursor: null,
        prevCursor: null,
        hasNext: false,
        hasPrev: false,
      };
    }

    const prevCursor = rows[0].id;
    const nextCursor = rows.at(-1)!.id;

    const [prevItem, nextItem] = await Promise.all([
      this.prisma.transaksi.findFirst({
        where: {
          ...baseWhere,
          id: { gt: prevCursor },
        },
        select: { id: true },
      }),
      this.prisma.transaksi.findFirst({
        where: {
          ...baseWhere,
          id: { lt: nextCursor },
        },
        select: { id: true },
      }),
    ]);

    return {
      data: rows,
      nextCursor,
      prevCursor,
      hasNext: Boolean(nextItem),
      hasPrev: Boolean(prevItem),
    };
  }

  listTransaksi(args: {
    page: CursorPageRequest;
    jenisTransaksi?: JenisTransaksi;
    tanggalFrom?: Date;
    tanggalTo?: Date;
    pegawaiId?: number;
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
    if (args.pegawaiId) {
      where.nasabah = {
        pegawaiId: args.pegawaiId,
        deletedAt: null,
      };
    }

    return this.findTransaksiList({
      page: args.page,
      where,
    });
  }

  listTransaksiByNasabah(args: { nasabahId: number; page: CursorPageRequest }) {
    return this.findTransaksiList({
      page: args.page,
      where: { nasabahId: args.nasabahId },
    });
  }

  listTransaksiByPegawai(args: { pegawaiId: number; page: CursorPageRequest }) {
    return this.findTransaksiList({
      page: args.page,
      where: { pegawaiId: args.pegawaiId },
    });
  }

  listTransaksiByRekening(args: {
    rekeningSimpananId: number;
    page: CursorPageRequest;
  }) {
    return this.findTransaksiList({
      page: args.page,
      where: { rekeningSimpananId: args.rekeningSimpananId },
    });
  }

  listTransaksiByPinjaman(args: {
    pinjamanId: number;
    page: CursorPageRequest;
  }) {
    return this.findTransaksiList({
      page: args.page,
      where: { pinjamanId: args.pinjamanId },
    });
  }
}
