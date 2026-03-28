import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  LaporanKeuangan,
  Prisma,
  StatusLaporan,
} from '@prisma/client';
import { LaporanRepository } from './laporan.repository';
import {
  RekapitulasiBulanan,
  RekapitulasiService,
} from './rekapitulasi/rekapitulasi.service';
import { AuditTrailService } from '../audit/audit.service';

type LaporanSnapshotView = {
  id: number;
  periodeBulan: number;
  periodeTahun: number;
  saldoAwal: number;
  totalSimpanan: number;
  totalPenarikan: number;
  totalPinjaman: number;
  totalAngsuran: number;
  totalPemasukan: number;
  totalPengeluaran: number;
  netCashflow: number;
  saldoAkhir: number;
  statusLaporan: StatusLaporan;
  generatedById: number;
  generatedAt: string;
};

@Injectable()
export class LaporanService {
  constructor(
    private readonly laporanRepository: LaporanRepository,
    private readonly auditTrailService: AuditTrailService,
    @Inject(RekapitulasiService)
    private readonly rekapitulasiService: {
      getRekapitulasiBulanan: (
        rawBulan?: number,
        rawTahun?: number,
      ) => Promise<RekapitulasiBulanan>;
    },
  ) {}

  private toNumber(value: Prisma.Decimal | number): number {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value.toString());
  }

  async generateLaporanKeuangan(
    bulan: number,
    tahun: number,
    userId: number,
  ): Promise<{ message: string; data: LaporanKeuangan }> {
    const rekap: RekapitulasiBulanan =
      await this.rekapitulasiService.getRekapitulasiBulanan(bulan, tahun);

    const payload = {
      periodeBulan: bulan,
      periodeTahun: tahun,
      totalSimpanan: rekap.keuangan.simpanan.total,
      totalPenarikan: rekap.transaksi.breakdown.pengeluaran.penarikan,
      totalPinjaman: rekap.keuangan.pinjaman.totalOutstanding,
      totalAngsuran: rekap.transaksi.breakdown.pemasukan.angsuran,
      saldoAkhir: rekap.ringkasan.saldoAkhir,
      generatedById: userId,
      generatedAt: new Date(),
    };

    const existing = await this.laporanRepository.findLaporanKeuanganByPeriode(
      bulan,
      tahun,
    );

    if (existing?.statusLaporan === StatusLaporan.FINAL) {
      throw new BadRequestException('Laporan keuangan sudah FINAL');
    }

    const laporan = existing
      ? await this.laporanRepository.updateLaporanKeuangan(existing.id, payload)
      : await this.laporanRepository.createLaporanKeuangan({
          ...payload,
          statusLaporan: StatusLaporan.DRAFT,
        });

    await this.auditTrailService.log({
      action: 'GENERATE_REPORT' as AuditAction,
      userId,
      entityName: 'laporan',
      entityId: laporan.id,
      before: existing
        ? {
            id: existing.id,
            periodeBulan: existing.periodeBulan,
            periodeTahun: existing.periodeTahun,
            statusLaporan: existing.statusLaporan,
            saldoAkhir: this.toNumber(existing.saldoAkhir),
            generatedAt: existing.generatedAt.toISOString(),
          }
        : null,
      after: {
        id: laporan.id,
        periodeBulan: laporan.periodeBulan,
        periodeTahun: laporan.periodeTahun,
        statusLaporan: laporan.statusLaporan,
        saldoAkhir: this.toNumber(laporan.saldoAkhir),
        generatedAt: laporan.generatedAt.toISOString(),
      },
    });

    return {
      message: 'Laporan keuangan berhasil di-generate',
      data: laporan,
    };
  }

  private mapLaporanSnapshot(laporan: LaporanKeuangan): LaporanSnapshotView {
    const totalSimpanan = this.toNumber(laporan.totalSimpanan);
    const totalPenarikan = this.toNumber(laporan.totalPenarikan);
    const totalPinjaman = this.toNumber(laporan.totalPinjaman);
    const totalAngsuran = this.toNumber(laporan.totalAngsuran);
    const saldoAkhir = this.toNumber(laporan.saldoAkhir);

    const totalPemasukan = totalSimpanan + totalAngsuran;
    const totalPengeluaran = totalPenarikan + totalPinjaman;
    const netCashflow = totalPemasukan - totalPengeluaran;
    const saldoAwal = saldoAkhir - netCashflow;

    return {
      id: laporan.id,
      periodeBulan: laporan.periodeBulan,
      periodeTahun: laporan.periodeTahun,
      saldoAwal,
      totalSimpanan,
      totalPenarikan,
      totalPinjaman,
      totalAngsuran,
      totalPemasukan,
      totalPengeluaran,
      netCashflow,
      saldoAkhir,
      statusLaporan: laporan.statusLaporan,
      generatedById: laporan.generatedById,
      generatedAt: laporan.generatedAt.toISOString(),
    };
  }

  async getLaporanKeuanganSnapshot(
    bulan?: number,
    tahun?: number,
  ): Promise<LaporanSnapshotView> {
    const laporan =
      typeof bulan === 'number' && typeof tahun === 'number'
        ? await this.laporanRepository.findLaporanKeuanganByPeriode(
            bulan,
            tahun,
          )
        : await this.laporanRepository.findLatestLaporanKeuangan();

    if (!laporan) {
      throw new NotFoundException('Laporan keuangan tidak ditemukan');
    }

    return this.mapLaporanSnapshot(laporan);
  }

  async finalizeLaporanKeuangan(
    id: number,
    userId: number,
  ): Promise<{ message: string; data: LaporanKeuangan }> {
    const laporan = await this.laporanRepository.findLaporanKeuanganById(id);
    if (!laporan) {
      throw new NotFoundException('Laporan keuangan tidak ditemukan');
    }

    const updated = await this.laporanRepository.updateLaporanStatus(
      id,
      StatusLaporan.FINAL,
    );

    await this.auditTrailService.log({
      action: 'FINALIZE_REPORT' as AuditAction,
      userId,
      entityName: 'laporan',
      entityId: updated.id,
      before: {
        statusLaporan: laporan.statusLaporan,
      },
      after: {
        statusLaporan: updated.statusLaporan,
      },
    });

    return {
      message: 'Laporan keuangan berhasil difinalisasi',
      data: updated,
    };
  }
}
