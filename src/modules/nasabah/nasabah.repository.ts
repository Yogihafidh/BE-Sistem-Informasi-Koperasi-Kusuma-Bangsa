import { Injectable } from '@nestjs/common';
import {
  Prisma,
  PrismaClient,
  NasabahStatus,
  JenisDokumen,
  JenisSimpanan,
  JenisTransaksi,
  PinjamanStatus,
} from '@prisma/client';
import {
  CursorPageRequest,
  CursorPageResult,
} from '../../common/types/pagination.type';

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

  private buildTransaksiWhere(args: {
    nasabahId: number;
    tanggalFrom?: Date;
    tanggalTo?: Date;
  }): Prisma.TransaksiWhereInput {
    const where: Prisma.TransaksiWhereInput = {
      nasabahId: args.nasabahId,
      deletedAt: null,
    };

    if (args.tanggalFrom || args.tanggalTo) {
      where.tanggal = {
        ...(args.tanggalFrom ? { gte: args.tanggalFrom } : {}),
        ...(args.tanggalTo ? { lte: args.tanggalTo } : {}),
      };
    }

    return where;
  }

  findNasabahSummaryById(id: number) {
    return this.prisma.nasabah.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        nama: true,
        pegawaiId: true,
        status: true,
      },
    });
  }

  groupTransaksiNasabahByJenisAllTime(nasabahId: number) {
    return this.prisma.transaksi.groupBy({
      by: ['jenisTransaksi'],
      where: this.buildTransaksiWhere({ nasabahId }),
      _sum: { nominal: true },
      _count: { _all: true },
    });
  }

  countTransaksiNasabahInRange(args: {
    nasabahId: number;
    tanggalFrom: Date;
    tanggalTo: Date;
  }) {
    return this.prisma.transaksi.count({
      where: this.buildTransaksiWhere({
        nasabahId: args.nasabahId,
        tanggalFrom: args.tanggalFrom,
        tanggalTo: args.tanggalTo,
      }),
    });
  }

  getLastTransactionAtNasabah(nasabahId: number) {
    return this.prisma.transaksi.aggregate({
      where: this.buildTransaksiWhere({ nasabahId }),
      _max: { tanggal: true },
    });
  }

  countDistinctHariAktifNasabahInRange(args: {
    nasabahId: number;
    tanggalFrom: Date;
    tanggalTo: Date;
  }) {
    return this.prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(DISTINCT DATE("tanggal" AT TIME ZONE 'UTC')) AS count
        FROM "Transaksi"
        WHERE "deletedAt" IS NULL
          AND "nasabahId" = ${args.nasabahId}
          AND "tanggal" >= ${args.tanggalFrom}
          AND "tanggal" <= ${args.tanggalTo}
      `,
    );
  }

  groupSaldoSimpananNasabahByJenis(nasabahId: number) {
    return this.prisma.rekeningSimpanan.groupBy({
      by: ['jenisSimpanan'],
      where: {
        nasabahId,
        deletedAt: null,
      },
      _sum: { saldoBerjalan: true },
    });
  }

  getPinjamanNasabahSnapshot(nasabahId: number) {
    return this.prisma.$queryRaw<
      {
        totalPinjaman: unknown;
        sisaPinjaman: unknown;
      }[]
    >(
      Prisma.sql`
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN "status" IN (
                  ${PinjamanStatus.DISETUJUI}::"PinjamanStatus",
                  ${PinjamanStatus.TERLAMBAT}::"PinjamanStatus",
                  ${PinjamanStatus.LUNAS}::"PinjamanStatus"
                )
                THEN "jumlahPinjaman"
                ELSE 0
              END
            ),
            0
          ) AS "totalPinjaman",
          COALESCE(
            SUM(
              CASE
                WHEN "status" IN (
                  ${PinjamanStatus.DISETUJUI}::"PinjamanStatus",
                  ${PinjamanStatus.TERLAMBAT}::"PinjamanStatus"
                )
                AND "sisaPinjaman" > 0
                THEN "sisaPinjaman"
                ELSE 0
              END
            ),
            0
          ) AS "sisaPinjaman"
        FROM "Pinjaman"
        WHERE "nasabahId" = ${nasabahId}
          AND "deletedAt" IS NULL
      `,
    );
  }

  getCashflowTrendNasabah(args: {
    nasabahId: number;
    fromMonth: Date;
    toMonth: Date;
  }) {
    return this.prisma.$queryRaw<
      {
        monthStart: Date;
        masuk: unknown;
        keluar: unknown;
      }[]
    >(
      Prisma.sql`
        SELECT
          m.month_start::date AS "monthStart",
          COALESCE(
            SUM(
              CASE
                WHEN t."jenisTransaksi" IN (
                  ${JenisTransaksi.SETORAN}::"JenisTransaksi",
                  ${JenisTransaksi.ANGSURAN}::"JenisTransaksi"
                )
                THEN t."nominal"
                ELSE 0
              END
            ),
            0
          ) AS "masuk",
          COALESCE(
            SUM(
              CASE
                WHEN t."jenisTransaksi" IN (
                  ${JenisTransaksi.PENARIKAN}::"JenisTransaksi",
                  ${JenisTransaksi.PENCAIRAN}::"JenisTransaksi"
                )
                THEN t."nominal"
                ELSE 0
              END
            ),
            0
          ) AS "keluar"
        FROM generate_series(
          ${args.fromMonth}::timestamptz,
          ${args.toMonth}::timestamptz,
          interval '1 month'
        ) AS m(month_start)
        LEFT JOIN "Transaksi" t
          ON t."nasabahId" = ${args.nasabahId}
         AND t."deletedAt" IS NULL
         AND date_trunc('month', t."tanggal" AT TIME ZONE 'UTC') =
             date_trunc('month', m.month_start AT TIME ZONE 'UTC')
        GROUP BY m.month_start
        ORDER BY m.month_start
      `,
    );
  }

  getTrenSisaPinjamanNasabah(args: {
    nasabahId: number;
    fromMonth: Date;
    toMonth: Date;
  }) {
    return this.prisma.$queryRaw<
      {
        monthStart: Date;
        sisa: unknown;
      }[]
    >(
      Prisma.sql`
        SELECT
          m.month_start::date AS "monthStart",
          COALESCE(
            SUM(
              GREATEST(
                p."totalPengembalian" - COALESCE(a."totalAngsuran", 0),
                0
              )
            ),
            0
          ) AS "sisa"
        FROM generate_series(
          ${args.fromMonth}::timestamptz,
          ${args.toMonth}::timestamptz,
          interval '1 month'
        ) AS m(month_start)
        LEFT JOIN "Pinjaman" p
          ON p."nasabahId" = ${args.nasabahId}
         AND p."deletedAt" IS NULL
         AND p."status" IN (
           ${PinjamanStatus.DISETUJUI}::"PinjamanStatus",
           ${PinjamanStatus.TERLAMBAT}::"PinjamanStatus",
           ${PinjamanStatus.LUNAS}::"PinjamanStatus"
         )
         AND (
           p."tanggalPersetujuan" IS NULL
           OR p."tanggalPersetujuan" <=
              (m.month_start + interval '1 month' - interval '1 millisecond')
         )
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(t."nominal"), 0) AS "totalAngsuran"
          FROM "Transaksi" t
          WHERE t."deletedAt" IS NULL
            AND t."nasabahId" = ${args.nasabahId}
            AND t."pinjamanId" = p."id"
            AND t."jenisTransaksi" = ${JenisTransaksi.ANGSURAN}::"JenisTransaksi"
            AND t."tanggal" <=
                (m.month_start + interval '1 month' - interval '1 millisecond')
        ) a ON true
        GROUP BY m.month_start
        ORDER BY m.month_start
      `,
    );
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
    page: CursorPageRequest,
    status?: NasabahStatus,
    pegawaiId?: number,
  ): Promise<CursorPageResult<NasabahListRow>> {
    const isBackward = typeof page.before === 'number';
    const baseWhere: Prisma.NasabahWhereInput = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(typeof pegawaiId === 'number' ? { pegawaiId } : {}),
    };

    const dataWhere: Prisma.NasabahWhereInput = {
      ...baseWhere,
      ...(typeof page.after === 'number' ? { id: { lt: page.after } } : {}),
      ...(typeof page.before === 'number' ? { id: { gt: page.before } } : {}),
    };

    const rows = await this.prisma.nasabah.findMany({
      where: dataWhere,
      select: nasabahListSelect,
      orderBy: { id: isBackward ? 'asc' : 'desc' },
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
      this.prisma.nasabah.findFirst({
        where: {
          ...baseWhere,
          id: { gt: prevCursor },
        },
        select: { id: true },
      }),
      this.prisma.nasabah.findFirst({
        where: {
          ...baseWhere,
          id: { lt: nextCursor },
        },
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
