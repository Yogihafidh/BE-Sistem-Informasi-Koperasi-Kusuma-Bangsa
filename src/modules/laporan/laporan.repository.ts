import { Injectable } from '@nestjs/common';
import { PrismaClient, StatusLaporan } from '@prisma/client';

@Injectable()
export class LaporanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // Mengambil laporan keuangan berdasarkan bulan dan tahun tertentu
  findLaporanKeuanganByPeriode(bulan: number, tahun: number) {
    return this.prisma.laporanKeuangan.findUnique({
      where: {
        periodeBulan_periodeTahun: {
          periodeBulan: bulan,
          periodeTahun: tahun,
        },
      },
    });
  }

  // Mengambil laporan keuangan terbaru (bulan & tahun paling akhir)
  findLatestLaporanKeuangan() {
    return this.prisma.laporanKeuangan.findFirst({
      orderBy: [
        { periodeTahun: 'desc' },
        { periodeBulan: 'desc' },
        { id: 'desc' },
      ],
    });
  }

  // Mengambil laporan keuangan berdasarkan ID
  findLaporanKeuanganById(id: number) {
    return this.prisma.laporanKeuangan.findUnique({ where: { id } });
  }

  // Upsert snapshot laporan keuangan per periode
  upsertLaporanKeuanganByPeriode(data: {
    periodeBulan: number;
    periodeTahun: number;
    totalSimpanan: number;
    totalPenarikan: number;
    totalPinjaman: number;
    totalAngsuran: number;
    saldoAkhir: number;
    generatedById: number;
    generatedAt: Date;
  }) {
    return this.prisma.laporanKeuangan.upsert({
      where: {
        periodeBulan_periodeTahun: {
          periodeBulan: data.periodeBulan,
          periodeTahun: data.periodeTahun,
        },
      },
      create: {
        ...data,
        statusLaporan: StatusLaporan.DRAFT,
      },
      update: {
        totalSimpanan: data.totalSimpanan,
        totalPenarikan: data.totalPenarikan,
        totalPinjaman: data.totalPinjaman,
        totalAngsuran: data.totalAngsuran,
        saldoAkhir: data.saldoAkhir,
        generatedById: data.generatedById,
        generatedAt: data.generatedAt,
      },
    });
  }

  // Mengupdate status laporan (misalnya: draft, final, dll)
  updateLaporanStatus(id: number, status: StatusLaporan) {
    return this.prisma.laporanKeuangan.update({
      where: { id },
      data: { statusLaporan: status },
    });
  }
}
