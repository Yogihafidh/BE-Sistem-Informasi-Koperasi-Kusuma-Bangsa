import { Injectable } from '@nestjs/common';
import { PrismaClient, StatusLaporan } from '@prisma/client';

@Injectable()
export class LaporanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findLaporanKeuanganByPeriode(bulan: number, tahun: number) {
    return this.prisma.laporanKeuangan.findFirst({
      where: { periodeBulan: bulan, periodeTahun: tahun },
    });
  }

  findLatestLaporanKeuangan() {
    return this.prisma.laporanKeuangan.findFirst({
      orderBy: [{ periodeTahun: 'desc' }, { periodeBulan: 'desc' }],
    });
  }

  findLaporanKeuanganById(id: number) {
    return this.prisma.laporanKeuangan.findUnique({ where: { id } });
  }

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

  updateLaporanStatus(id: number, status: StatusLaporan) {
    return this.prisma.laporanKeuangan.update({
      where: { id },
      data: { statusLaporan: status },
    });
  }
}
