import { Injectable } from '@nestjs/common';
import { PrismaClient, StatusLaporan } from '@prisma/client';

@Injectable()
export class LaporanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // Mengambil laporan keuangan berdasarkan bulan dan tahun tertentu
  findLaporanKeuanganByPeriode(bulan: number, tahun: number) {
    return this.prisma.laporanKeuangan.findFirst({
      where: { periodeBulan: bulan, periodeTahun: tahun },
    });
  }

  // Mengambil laporan keuangan terbaru (bulan & tahun paling akhir)
  findLatestLaporanKeuangan() {
    return this.prisma.laporanKeuangan.findFirst({
      orderBy: [{ periodeTahun: 'desc' }, { periodeBulan: 'desc' }],
    });
  }

  // Mengambil laporan keuangan berdasarkan ID
  findLaporanKeuanganById(id: number) {
    return this.prisma.laporanKeuangan.findUnique({ where: { id } });
  }

  // Menyimpan data laporan keuangan baru
  createLaporanKeuangan(data: {
    periodeBulan: number;
    periodeTahun: number;
    totalSimpanan: number;
    totalPenarikan: number;
    totalPinjaman: number;
    totalAngsuran: number;
    saldoAkhir: number;
    statusLaporan: StatusLaporan;
    generatedById: number;
    generatedAt: Date;
  }) {
    return this.prisma.laporanKeuangan.create({ data });
  }

  // Mengupdate data laporan keuangan (nilai keuangan & metadata)
  updateLaporanKeuangan(
    id: number,
    data: {
      totalSimpanan: number;
      totalPenarikan: number;
      totalPinjaman: number;
      totalAngsuran: number;
      saldoAkhir: number;
      generatedById: number;
      generatedAt: Date;
    },
  ) {
    return this.prisma.laporanKeuangan.update({
      where: { id },
      data,
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
