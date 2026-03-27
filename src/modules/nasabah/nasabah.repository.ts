import { Injectable } from '@nestjs/common';
import {
  Prisma,
  PrismaClient,
  NasabahStatus,
  JenisDokumen,
  JenisSimpanan,
} from '@prisma/client';

export const nasabahListSelect = Prisma.validator<Prisma.NasabahSelect>()({
  id: true,
  nomorAnggota: true,
  nama: true,
  nik: true,
  noHp: true,
  pekerjaan: true,
  instansi: true,
  status: true,
  tanggalDaftar: true,
});

export type NasabahListRow = Prisma.NasabahGetPayload<{
  select: typeof nasabahListSelect;
}>;

@Injectable()
export class NasabahRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

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
    return this.prisma.pegawai.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        statusAktif: true,
      },
    });
  }

  findNasabahByNik(nik: string) {
    return this.prisma.nasabah.findUnique({
      where: { nik },
    });
  }

  findNasabahByNomorAnggota(nomorAnggota: string) {
    return this.prisma.nasabah.findUnique({
      where: { nomorAnggota },
    });
  }

  createNasabah(
    data: {
      pegawaiId: number;
      nomorAnggota: string;
      nama: string;
      nik: string;
      alamat: string;
      noHp: string;
      pekerjaan: string;
      instansi?: string;
      penghasilanBulanan: number;
      tanggalLahir: Date;
      tanggalDaftar: Date;
      status: NasabahStatus;
      catatan?: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    return client.nasabah.create({
      data,
      include: {
        pegawai: {
          select: {
            id: true,
            nama: true,
            jabatan: true,
          },
        },
        user: {
          select: { id: true, username: true, email: true },
        },
        dokumen: {
          where: { deletedAt: null },
        },
      },
    });
  }

  async findAllNasabah(
    cursor: number | undefined,
    take: number,
    status?: NasabahStatus,
  ) {
    const data = await this.prisma.nasabah.findMany({
      where: {
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      select: nasabahListSelect,
      orderBy: { id: 'desc' },
      take: take + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
    });

    let nextCursor: number | null = null;
    if (data.length > take) {
      const nextItem = data.pop();
      nextCursor = nextItem?.id ?? null;
    }

    return { data, nextCursor };
  }

  findNasabahById(id: number) {
    return this.prisma.nasabah.findFirst({
      where: { id, deletedAt: null },
      include: {
        pegawai: {
          select: {
            id: true,
            nama: true,
            jabatan: true,
          },
        },
        user: {
          select: { id: true, username: true, email: true },
        },
        dokumen: {
          where: { deletedAt: null },
        },
      },
    });
  }

  updateNasabah(
    id: number,
    data: {
      pegawaiId?: number;
      nama?: string;
      alamat?: string;
      noHp?: string;
      pekerjaan?: string;
      instansi?: string;
      penghasilanBulanan?: number;
      tanggalLahir?: Date;
      catatan?: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    return client.nasabah.update({
      where: { id },
      data,
      include: {
        pegawai: {
          select: {
            id: true,
            nama: true,
            jabatan: true,
          },
        },
        user: {
          select: { id: true, username: true, email: true },
        },
        dokumen: {
          where: { deletedAt: null },
        },
      },
    });
  }

  updateNasabahStatus(
    id: number,
    status: NasabahStatus,
    catatan?: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    return client.nasabah.update({
      where: { id },
      data: { status, catatan },
      include: {
        pegawai: {
          select: {
            id: true,
            nama: true,
            jabatan: true,
          },
        },
        user: {
          select: { id: true, username: true, email: true },
        },
        dokumen: {
          where: { deletedAt: null },
        },
      },
    });
  }

  findRekeningSimpananByNasabahAndJenis(
    nasabahId: number,
    jenisSimpanan: JenisSimpanan,
  ) {
    return this.prisma.rekeningSimpanan.findFirst({
      where: { nasabahId, jenisSimpanan, deletedAt: null },
    });
  }

  createRekeningSimpanan(
    data: {
      nasabahId: number;
      jenisSimpanan: JenisSimpanan;
      saldoBerjalan: number;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    return client.rekeningSimpanan.create({
      data,
    });
  }

  createNasabahDokumen(
    data: {
      nasabahId: number;
      jenisDokumen: JenisDokumen;
      fileKey: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    return client.nasabahDokumen.create({
      data,
    });
  }

  findNasabahDokumenByJenis(nasabahId: number, jenisDokumen: JenisDokumen) {
    return this.prisma.nasabahDokumen.findFirst({
      where: { nasabahId, jenisDokumen, deletedAt: null },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  findNasabahDokumenById(id: number) {
    return this.prisma.nasabahDokumen.findUnique({
      where: { id },
      include: {
        nasabah: {
          select: {
            id: true,
            pegawaiId: true,
          },
        },
      },
    });
  }

  updateNasabahDokumen(
    id: number,
    data: {
      fileKey: string;
      uploadedAt?: Date;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    return client.nasabahDokumen.update({
      where: { id },
      data,
    });
  }

  softDeleteNasabahDokumen(id: number, tx?: Prisma.TransactionClient) {
    const client = this.getClient(tx);
    return client.nasabahDokumen.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}
