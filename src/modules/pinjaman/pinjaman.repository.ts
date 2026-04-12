import { Injectable } from '@nestjs/common';
import {
  JenisSimpanan,
  JenisTransaksi,
  PinjamanStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { CursorPageRequest } from '../../common/types/pagination.type';

@Injectable()
export class PinjamanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  findPegawaiByUserId(userId: number) {
    return this.prisma.pegawai.findUnique({
      where: { userId },
      select: {
        id: true,
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

  findRekeningPokokByNasabahId(nasabahId: number) {
    return this.prisma.rekeningSimpanan.findFirst({
      where: {
        nasabahId,
        jenisSimpanan: JenisSimpanan.POKOK,
        deletedAt: null,
      },
      select: {
        id: true,
        saldoBerjalan: true,
      },
    });
  }

  createPinjaman(
    data: {
      nasabahId: number;
      jumlahPinjaman: number;
      bungaPersen: number;
      tenorBulan: number;
      totalPengembalian: number;
      angsuranPerBulan: number;
      sisaPinjaman: number;
      status: PinjamanStatus;
      tanggalPersetujuan?: Date | null;
      jatuhTempo?: Date | null;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    return client.pinjaman.create({
      data,
      include: {
        nasabah: true,
        verifiedBy: true,
      },
    });
  }

  findPinjamanById(id: number) {
    return this.prisma.pinjaman.findFirst({
      where: { id, deletedAt: null },
      include: {
        nasabah: true,
        verifiedBy: true,
      },
    });
  }

  findPinjamanDetailById(id: number) {
    return this.prisma.pinjaman.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        jumlahPinjaman: true,
        bungaPersen: true,
        tenorBulan: true,
        totalPengembalian: true,
        angsuranPerBulan: true,
        sisaPinjaman: true,
        status: true,
        tanggalPersetujuan: true,
        jatuhTempo: true,
        nasabah: {
          select: {
            pegawaiId: true,
            nomorAnggota: true,
            nama: true,
            nik: true,
            alamat: true,
            noHp: true,
            pekerjaan: true,
            instansi: true,
            penghasilanBulanan: true,
            tanggalLahir: true,
            tanggalDaftar: true,
            status: true,
            catatan: true,
          },
        },
        verifiedBy: {
          select: {
            nama: true,
            jabatan: true,
            noHp: true,
          },
        },
      },
    });
  }

  softDeletePinjaman(id: number) {
    return this.prisma.pinjaman.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: {
        nasabah: true,
        verifiedBy: true,
      },
    });
  }

  async listPinjamanByNasabah(args: {
    nasabahId: number;
    page: CursorPageRequest;
  }) {
    const isBackward = typeof args.page.before === 'number';
    const where: Prisma.PinjamanWhereInput = {
      nasabahId: args.nasabahId,
      deletedAt: null,
      ...(typeof args.page.after === 'number'
        ? { id: { gt: args.page.after } }
        : {}),
      ...(typeof args.page.before === 'number'
        ? { id: { lt: args.page.before } }
        : {}),
    };

    const data = await this.prisma.pinjaman.findMany({
      where,
      include: {
        verifiedBy: true,
      },
      orderBy: { id: isBackward ? 'desc' : 'asc' },
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
      this.prisma.pinjaman.findFirst({
        where: {
          nasabahId: args.nasabahId,
          deletedAt: null,
          id: { lt: prevCursor },
        },
        select: { id: true },
      }),
      this.prisma.pinjaman.findFirst({
        where: {
          nasabahId: args.nasabahId,
          deletedAt: null,
          id: { gt: nextCursor },
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

  private buildNominalCursorFilter(args: {
    nominalSort: Prisma.SortOrder;
    cursorNominal: Prisma.Decimal;
    cursorId: number;
    direction: 'after' | 'before';
  }): Prisma.PinjamanWhereInput {
    if (args.nominalSort === Prisma.SortOrder.asc) {
      if (args.direction === 'after') {
        return {
          OR: [
            { jumlahPinjaman: { gt: args.cursorNominal } },
            {
              AND: [
                { jumlahPinjaman: args.cursorNominal },
                { id: { gt: args.cursorId } },
              ],
            },
          ],
        };
      }

      return {
        OR: [
          { jumlahPinjaman: { lt: args.cursorNominal } },
          {
            AND: [
              { jumlahPinjaman: args.cursorNominal },
              { id: { lt: args.cursorId } },
            ],
          },
        ],
      };
    }

    if (args.direction === 'after') {
      return {
        OR: [
          { jumlahPinjaman: { lt: args.cursorNominal } },
          {
            AND: [
              { jumlahPinjaman: args.cursorNominal },
              { id: { lt: args.cursorId } },
            ],
          },
        ],
      };
    }

    return {
      OR: [
        { jumlahPinjaman: { gt: args.cursorNominal } },
        {
          AND: [
            { jumlahPinjaman: args.cursorNominal },
            { id: { gt: args.cursorId } },
          ],
        },
      ],
    };
  }

  private buildNominalBoundaryFilter(args: {
    nominalSort: Prisma.SortOrder;
    nominal: Prisma.Decimal;
    id: number;
    side: 'prev' | 'next';
  }): Prisma.PinjamanWhereInput {
    if (args.nominalSort === Prisma.SortOrder.asc) {
      if (args.side === 'prev') {
        return {
          OR: [
            { jumlahPinjaman: { lt: args.nominal } },
            {
              AND: [{ jumlahPinjaman: args.nominal }, { id: { lt: args.id } }],
            },
          ],
        };
      }

      return {
        OR: [
          { jumlahPinjaman: { gt: args.nominal } },
          {
            AND: [{ jumlahPinjaman: args.nominal }, { id: { gt: args.id } }],
          },
        ],
      };
    }

    if (args.side === 'prev') {
      return {
        OR: [
          { jumlahPinjaman: { gt: args.nominal } },
          {
            AND: [{ jumlahPinjaman: args.nominal }, { id: { gt: args.id } }],
          },
        ],
      };
    }

    return {
      OR: [
        { jumlahPinjaman: { lt: args.nominal } },
        {
          AND: [{ jumlahPinjaman: args.nominal }, { id: { lt: args.id } }],
        },
      ],
    };
  }

  listAllPinjaman(args: {
    status?: PinjamanStatus;
    nominalSort: Prisma.SortOrder;
    page: CursorPageRequest;
    cursorNominal?: Prisma.Decimal;
    cursorId?: number;
  }) {
    const where: Prisma.PinjamanWhereInput = {
      deletedAt: null,
      ...(args.status ? { status: args.status } : {}),
    };

    const baseOrder = args.nominalSort;
    const isBackward = typeof args.page.before === 'number';
    const reversedOrder =
      baseOrder === Prisma.SortOrder.asc
        ? Prisma.SortOrder.desc
        : Prisma.SortOrder.asc;
    const queryOrder = isBackward ? reversedOrder : baseOrder;

    const hasCursor =
      typeof args.cursorId === 'number' && args.cursorNominal !== undefined;
    let cursorFilter: Prisma.PinjamanWhereInput | undefined;

    if (hasCursor) {
      cursorFilter = this.buildNominalCursorFilter({
        nominalSort: baseOrder,
        cursorNominal: args.cursorNominal as Prisma.Decimal,
        cursorId: args.cursorId as number,
        direction: isBackward ? 'before' : 'after',
      });
    }

    return this.prisma.pinjaman.findMany({
      where: { ...where, ...(cursorFilter ? { AND: [cursorFilter] } : {}) },
      include: {
        nasabah: true,
        verifiedBy: true,
      },
      orderBy: [{ jumlahPinjaman: queryOrder }, { id: queryOrder }],
      take: args.page.take,
    });
  }

  findPinjamanPrevByNominalBoundary(args: {
    status?: PinjamanStatus;
    nominalSort: Prisma.SortOrder;
    nominal: Prisma.Decimal;
    id: number;
  }) {
    return this.prisma.pinjaman.findFirst({
      where: {
        deletedAt: null,
        ...(args.status ? { status: args.status } : {}),
        AND: [
          this.buildNominalBoundaryFilter({
            nominalSort: args.nominalSort,
            nominal: args.nominal,
            id: args.id,
            side: 'prev',
          }),
        ],
      },
      select: { id: true },
    });
  }

  findPinjamanNextByNominalBoundary(args: {
    status?: PinjamanStatus;
    nominalSort: Prisma.SortOrder;
    nominal: Prisma.Decimal;
    id: number;
  }) {
    return this.prisma.pinjaman.findFirst({
      where: {
        deletedAt: null,
        ...(args.status ? { status: args.status } : {}),
        AND: [
          this.buildNominalBoundaryFilter({
            nominalSort: args.nominalSort,
            nominal: args.nominal,
            id: args.id,
            side: 'next',
          }),
        ],
      },
      select: { id: true },
    });
  }

  findPinjamanCursorAnchor(cursorId: number, status?: PinjamanStatus) {
    return this.prisma.pinjaman.findFirst({
      where: {
        id: cursorId,
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      select: {
        id: true,
        jumlahPinjaman: true,
      },
    });
  }

  updatePinjamanStatus(
    args: {
      id: number;
      status: PinjamanStatus;
      verifiedById?: number;
      tanggalPersetujuan?: Date | null;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    return client.pinjaman.update({
      where: { id: args.id },
      data: {
        status: args.status,
        verifiedById: args.verifiedById,
        tanggalPersetujuan: args.tanggalPersetujuan,
      },
      include: {
        nasabah: true,
        verifiedBy: true,
      },
    });
  }

  findPencairanTransaksi(pinjamanId: number) {
    return this.prisma.transaksi.aggregate({
      where: {
        pinjamanId,
        jenisTransaksi: JenisTransaksi.PENCAIRAN,
        deletedAt: null,
      },
      _sum: {
        nominal: true,
      },
    });
  }
}
