import {
  BadRequestException,
  Inject,
  InternalServerErrorException,
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
  totalSetoran: number;
  totalSimpanan: number;
  totalPenarikan: number;
  totalPencairan: number;
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

  private almostEqual(left: number, right: number, epsilon = 1e-6): boolean {
    return Math.abs(left - right) <= epsilon;
  }

  private buildFlowCashflow(args: {
    saldoAwal: number;
    setoran: number;
    angsuran: number;
    penarikan: number;
    pencairan: number;
  }) {
    const totalPemasukan = args.setoran + args.angsuran;
    const totalPengeluaran = args.penarikan + args.pencairan;
    const netCashflow = totalPemasukan - totalPengeluaran;
    const saldoAkhir = args.saldoAwal + netCashflow;

    return {
      saldoAwal: args.saldoAwal,
      totalSetoran: args.setoran,
      totalAngsuran: args.angsuran,
      totalPenarikan: args.penarikan,
      totalPencairan: args.pencairan,
      totalPemasukan,
      totalPengeluaran,
      netCashflow,
      saldoAkhir,
    };
  }

  private assertCashflowConsistency(snapshot: {
    saldoAwal: number;
    totalPemasukan: number;
    totalPengeluaran: number;
    netCashflow: number;
    saldoAkhir: number;
  }) {
    const isNetValid = this.almostEqual(
      snapshot.totalPemasukan - snapshot.totalPengeluaran,
      snapshot.netCashflow,
    );
    const isSaldoValid = this.almostEqual(
      snapshot.saldoAwal + snapshot.netCashflow,
      snapshot.saldoAkhir,
    );

    if (!isNetValid || !isSaldoValid) {
      throw new InternalServerErrorException(
        'Snapshot laporan tidak konsisten: validasi cashflow gagal',
      );
    }
  }

  private buildSnapshotFromRekap(rekap: RekapitulasiBulanan) {
    const snapshot = this.buildFlowCashflow({
      saldoAwal: rekap.ringkasan.saldoAwal,
      setoran: rekap.transaksi.breakdown.pemasukan.setoran,
      angsuran: rekap.transaksi.breakdown.pemasukan.angsuran,
      penarikan: rekap.transaksi.breakdown.pengeluaran.penarikan,
      pencairan: rekap.transaksi.breakdown.pengeluaran.pencairan,
    });

    if (!this.almostEqual(snapshot.saldoAkhir, rekap.ringkasan.saldoAkhir)) {
      throw new InternalServerErrorException(
        'Snapshot laporan tidak konsisten: saldo akhir rekap tidak sinkron',
      );
    }

    this.assertCashflowConsistency(snapshot);

    return snapshot;
  }

  async generateLaporanKeuangan(
    bulan: number,
    tahun: number,
    userId: number,
  ): Promise<{ message: string; data: LaporanKeuangan }> {
    // Rekapitulasi adalah source of truth untuk cashflow periodik.
    const rekap: RekapitulasiBulanan =
      await this.rekapitulasiService.getRekapitulasiBulanan(bulan, tahun);
    const snapshot = this.buildSnapshotFromRekap(rekap);

    // Simpan flow-only snapshot ke tabel laporan (kolom lama dipakai sebagai storage kompatibel).
    const payload = {
      periodeBulan: bulan,
      periodeTahun: tahun,
      totalSimpanan: snapshot.totalSetoran,
      totalPenarikan: snapshot.totalPenarikan,
      totalPinjaman: snapshot.totalPencairan,
      totalAngsuran: snapshot.totalAngsuran,
      saldoAkhir: snapshot.saldoAkhir,
      generatedById: userId,
      generatedAt: new Date(),
    };

    // Cek apakah laporan periode ini sudah ada
    const existing = await this.laporanRepository.findLaporanKeuanganByPeriode(
      bulan,
      tahun,
    );

    // Jika sudah FINAL maka tidak boleh diubah
    if (existing?.statusLaporan === StatusLaporan.FINAL) {
      throw new BadRequestException('Laporan keuangan sudah FINAL');
    }

    // Upsert untuk menjaga satu snapshot per periode.
    const laporan =
      await this.laporanRepository.upsertLaporanKeuanganByPeriode(payload);

    // Catat audit trail (siapa generate laporan)
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

  // MAP DATA LAPORAN KE VIEW
  private mapLaporanSnapshot(laporan: LaporanKeuangan): LaporanSnapshotView {
    const totalSetoran = this.toNumber(laporan.totalSimpanan);
    const totalPenarikan = this.toNumber(laporan.totalPenarikan);
    const totalPencairan = this.toNumber(laporan.totalPinjaman);
    const totalAngsuran = this.toNumber(laporan.totalAngsuran);
    const saldoAkhir = this.toNumber(laporan.saldoAkhir);

    const flowSnapshot = this.buildFlowCashflow({
      saldoAwal: 0,
      setoran: totalSetoran,
      angsuran: totalAngsuran,
      penarikan: totalPenarikan,
      pencairan: totalPencairan,
    });
    const saldoAwal = saldoAkhir - flowSnapshot.netCashflow;
    const snapshot = this.buildFlowCashflow({
      saldoAwal,
      setoran: totalSetoran,
      angsuran: totalAngsuran,
      penarikan: totalPenarikan,
      pencairan: totalPencairan,
    });
    this.assertCashflowConsistency(snapshot);

    return {
      id: laporan.id,
      periodeBulan: laporan.periodeBulan,
      periodeTahun: laporan.periodeTahun,
      saldoAwal: snapshot.saldoAwal,
      totalSetoran: snapshot.totalSetoran,
      totalSimpanan: snapshot.totalSetoran,
      totalPenarikan: snapshot.totalPenarikan,
      totalPencairan: snapshot.totalPencairan,
      totalPinjaman: snapshot.totalPencairan,
      totalAngsuran: snapshot.totalAngsuran,
      totalPemasukan: snapshot.totalPemasukan,
      totalPengeluaran: snapshot.totalPengeluaran,
      netCashflow: snapshot.netCashflow,
      saldoAkhir: snapshot.saldoAkhir,
      statusLaporan: laporan.statusLaporan,
      generatedById: laporan.generatedById,
      generatedAt: laporan.generatedAt.toISOString(),
    };
  }

  async getLaporanKeuanganSnapshot(
    bulan?: number,
    tahun?: number,
  ): Promise<LaporanSnapshotView> {
    // Jika ada bulan & tahun ambil laporan periode itu tapi jika tidak ambil laporan terbaru
    const laporan =
      typeof bulan === 'number' && typeof tahun === 'number'
        ? await this.laporanRepository.findLaporanKeuanganByPeriode(
            bulan,
            tahun,
          )
        : await this.laporanRepository.findLatestLaporanKeuangan();

    // Jika tidak ditemukan makaerror
    if (!laporan) {
      throw new NotFoundException('Laporan keuangan tidak ditemukan');
    }

    return this.mapLaporanSnapshot(laporan);
  }

  // FINALIZE LAPORAN
  async finalizeLaporanKeuangan(
    id: number,
    userId: number,
  ): Promise<{ message: string; data: LaporanKeuangan }> {
    // Ambil laporan berdasarkan ID
    const laporan = await this.laporanRepository.findLaporanKeuanganById(id);

    // Jika tidak ada kembalikan error
    if (!laporan) {
      throw new NotFoundException('Laporan keuangan tidak ditemukan');
    }

    // Update status jadi FINAL
    const updated = await this.laporanRepository.updateLaporanStatus(
      id,
      StatusLaporan.FINAL,
    );

    // Catat audit trail (siapa finalize laporan)
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
