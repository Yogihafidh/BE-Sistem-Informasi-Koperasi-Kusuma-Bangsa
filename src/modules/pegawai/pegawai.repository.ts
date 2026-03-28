import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  CursorPageRequest,
  CursorPageResult,
} from '../../common/types/pagination.type';

export const pegawaiListSelect = Prisma.validator<Prisma.PegawaiSelect>()({
  id: true,
  userId: true,
  nama: true,
  jabatan: true,
  noHp: true,
  alamat: true,
  statusAktif: true,
});

export type PegawaiListRow = Prisma.PegawaiGetPayload<{
  select: typeof pegawaiListSelect;
}>;

@Injectable()
export class PegawaiRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  findUserById(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
      },
    });
  }

  findPegawaiByUserId(userId: number) {
    return this.prisma.pegawai.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
  }

  createPegawai(
    data: {
      userId: number;
      nama: string;
      jabatan: string;
      noHp: string;
      alamat: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    return client.pegawai.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
  }

  async findAllPegawai(
    page: CursorPageRequest,
  ): Promise<CursorPageResult<PegawaiListRow>> {
    const isBackward = typeof page.before === 'number';
    const dataWhere: Prisma.PegawaiWhereInput = {
      ...(typeof page.after === 'number' ? { id: { gt: page.after } } : {}),
      ...(typeof page.before === 'number' ? { id: { lt: page.before } } : {}),
    };

    const rows = await this.prisma.pegawai.findMany({
      where: dataWhere,
      select: pegawaiListSelect,
      orderBy: { id: isBackward ? 'desc' : 'asc' },
      take: page.take,
    });

    const data = isBackward ? [...rows].reverse() : rows;

    if (data.length === 0) {
      return {
        data,
        nextCursor: null,
        prevCursor: null,
        hasNext: false,
        hasPrev: false,
      };
    }

    const prevCursor = data[0].id;
    const nextCursor = data.at(-1)!.id;

    const [prevItem, nextItem] = await Promise.all([
      this.prisma.pegawai.findFirst({
        where: { id: { lt: prevCursor } },
        select: { id: true },
      }),
      this.prisma.pegawai.findFirst({
        where: { id: { gt: nextCursor } },
        select: { id: true },
      }),
    ]);

    return {
      data,
      nextCursor,
      prevCursor,
      hasNext: Boolean(nextItem),
      hasPrev: Boolean(prevItem),
    };
  }

  findPegawaiById(id: number) {
    return this.prisma.pegawai.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
  }

  updatePegawai(
    id: number,
    data: {
      nama?: string;
      jabatan?: string;
      noHp?: string;
      alamat?: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    return client.pegawai.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
  }

  updatePegawaiStatus(
    id: number,
    statusAktif: boolean,
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    return client.pegawai.update({
      where: { id },
      data: { statusAktif },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
  }
}
