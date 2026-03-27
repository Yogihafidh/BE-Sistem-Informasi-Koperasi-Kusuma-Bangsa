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

  findPinjamanDetailById(id: number) {
    return this.prisma.pinjaman.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        jumlahPinjaman: true,
        bungaPersen: true,
        tenorBulan: true,
        sisaPinjaman: true,
        status: true,
        tanggalPersetujuan: true,
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

  listAllPinjaman(args: {
    status?: PinjamanStatus;
    nominalSort: Prisma.SortOrder;
    take: number;
    cursorNominal?: Prisma.Decimal;
    cursorId?: number;
  }) {
    const where: Prisma.PinjamanWhereInput = {
      deletedAt: null,
      ...(args.status ? { status: args.status } : {}),
    };

    const hasCursor =
      typeof args.cursorId === 'number' && args.cursorNominal !== undefined;
    let cursorFilter: Prisma.PinjamanWhereInput | undefined;

    if (hasCursor) {
      if (args.nominalSort === Prisma.SortOrder.asc) {
        cursorFilter = {
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
      } else {
        cursorFilter = {
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
    }

    return this.prisma.pinjaman.findMany({
      where: {
        ...where,
        ...(cursorFilter ? { AND: [cursorFilter] } : {}),
      },
      include: {
        nasabah: true,
        verifiedBy: true,
      },
      orderBy: [{ jumlahPinjaman: args.nominalSort }, { id: args.nominalSort }],
      take: args.take + 1,
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
