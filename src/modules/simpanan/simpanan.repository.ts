import { Injectable } from '@nestjs/common';
import { PinjamanStatus, Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class SimpananRepository {
  constructor(private readonly prisma: PrismaClient) {}

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

  countPinjamanAktifByNasabah(nasabahId: number): Promise<number> {
    return this.prisma.pinjaman.count({
      where: {
        nasabahId,
        deletedAt: null,
        status: { in: [PinjamanStatus.DISETUJUI, PinjamanStatus.TERLAMBAT] },
        sisaPinjaman: { gt: new Prisma.Decimal(0) },
      },
    });
  }

  listRekeningByNasabah(nasabahId: number) {
    return this.prisma.rekeningSimpanan.findMany({
      where: { nasabahId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  findRekeningById(id: number) {
    return this.prisma.rekeningSimpanan.findFirst({
      where: { id, deletedAt: null },
      include: {
        nasabah: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });
  }

  softDeleteRekening(id: number) {
    return this.prisma.rekeningSimpanan.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: {
        nasabah: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });
  }
}
