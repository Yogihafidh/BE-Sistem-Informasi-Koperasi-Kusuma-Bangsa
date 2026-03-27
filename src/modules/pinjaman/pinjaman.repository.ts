import { Injectable } from '@nestjs/common';
import {
  JenisTransaksi,
  PinjamanStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';

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

  createPinjaman(
    data: {
      nasabahId: number;
      jumlahPinjaman: number;
      bungaPersen: number;
      tenorBulan: number;
      sisaPinjaman: number;
      status: PinjamanStatus;
      tanggalPersetujuan?: Date | null;
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
    cursor?: number;
    take: number;
  }) {
    const data = await this.prisma.pinjaman.findMany({
      where: { nasabahId: args.nasabahId, deletedAt: null },
      include: {
        verifiedBy: true,
      },
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
