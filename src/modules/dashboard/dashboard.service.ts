import { Injectable } from '@nestjs/common';
import { JenisSimpanan, JenisTransaksi, Prisma } from '@prisma/client';
import { DashboardRepository } from './dashboard.repository';
import { SettingsService } from '../settings/settings.service';
import { SETTING_KEYS } from '../settings/constants/settings.constants';

@Injectable()
export class DashboardService {
  constructor(
    private readonly dashboardRepository: DashboardRepository,
    private readonly settingsService: SettingsService,
  ) {}

  private toNumber(value: Prisma.Decimal | number | bigint | null | undefined) {
    if (value === null || value === undefined) {
      return 0;
    }
    if (typeof value === 'bigint') {
      return Number(value);
    }
    return value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
  }

  private getMonthRange(bulan: number, tahun: number) {
    const start = new Date(tahun, bulan - 1, 1, 0, 0, 0, 0);
    const end = new Date(tahun, bulan, 0, 23, 59, 59, 999);
    return { start, end };
  }

  private getTrendRange(bulan: number, tahun: number, trendMonths: number) {
    const endMonth = new Date(Date.UTC(tahun, bulan - 1, 1));
    const startMonth = new Date(Date.UTC(tahun, bulan - trendMonths, 1));

    return { startMonth, endMonth };
  }

  private calculateGrowth(current: number, previous: number): number {
    if (previous <= 0) {
      return 0;
    }

    return (current - previous) / previous;
  }

  private formatMonthLabel(bulan: number, tahun: number) {
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'Mei',
      'Jun',
      'Jul',
      'Agu',
      'Sep',
      'Okt',
      'Nov',
      'Des',
    ];
    return `${monthNames[bulan - 1]} ${tahun}`;
  }

  async clearDashboardCache(_source = 'unknown'): Promise<void> {
    await Promise.resolve();
  }

  async invalidateDashboardBecauseFinancialChanged(
    _source = 'unknown',
  ): Promise<void> {
    await Promise.resolve();
  }

  async getDashboard(bulan: number, tahun: number) {
    const trendMonthsSetting = await this.settingsService.getNumber(
      SETTING_KEYS.DASHBOARD_TREND_MONTHS,
    );
    const trendMonths = Math.max(1, Math.floor(trendMonthsSetting));

    const { start, end } = this.getMonthRange(bulan, tahun);
    const previous = this.getMonthRange(
      bulan === 1 ? 12 : bulan - 1,
      bulan === 1 ? tahun - 1 : tahun,
    );
    const trendRange = this.getTrendRange(bulan, tahun, trendMonths);

    const [
      currentGroupedTransaksi,
      currentTotalTransaksi,
      previousTotalTransaksi,
      saldoGrouped,
      totalOutstandingAgg,
      topOutstanding,
      totalNasabah,
      aktifNasabah,
      nasabahBaru,
      nasabahKeluar,
      cashflowTrendRows,
      keanggotaanTrendRows,
    ] = await Promise.all([
      this.dashboardRepository.groupTransaksiByJenis({
        tanggalFrom: start,
        tanggalTo: end,
      }),
      this.dashboardRepository.countTransaksi({
        tanggalFrom: start,
        tanggalTo: end,
      }),
      this.dashboardRepository.countTransaksi({
        tanggalFrom: previous.start,
        tanggalTo: previous.end,
      }),
      this.dashboardRepository.groupSaldoSimpananByJenis(),
      this.dashboardRepository.sumPinjamanAktifNominal(),
      this.dashboardRepository.listTopOutstandingPinjaman(5),
      this.dashboardRepository.countNasabahTotal(),
      this.dashboardRepository.countNasabahAktif(),
      this.dashboardRepository.countNasabahBaru({
        tanggalFrom: start,
        tanggalTo: end,
      }),
      this.dashboardRepository.countNasabahKeluar({
        tanggalFrom: start,
        tanggalTo: end,
      }),
      this.dashboardRepository.getCashflowTrend({
        startMonth: trendRange.startMonth,
        endMonth: trendRange.endMonth,
      }),
      this.dashboardRepository.getKeanggotaanTrend({
        startMonth: trendRange.startMonth,
        endMonth: trendRange.endMonth,
      }),
    ]);

    const nominalByJenis = (rows: typeof currentGroupedTransaksi) => {
      const map = {
        [JenisTransaksi.SETORAN]: 0,
        [JenisTransaksi.ANGSURAN]: 0,
        [JenisTransaksi.PENARIKAN]: 0,
        [JenisTransaksi.PENCAIRAN]: 0,
      };

      for (const row of rows) {
        map[row.jenisTransaksi] = this.toNumber(row._sum.nominal);
      }

      return map;
    };

    const currentNominal = nominalByJenis(currentGroupedTransaksi);
    const komposisiSimpanan = {
      pokok: 0,
      wajib: 0,
      sukarela: 0,
    };
    for (const row of saldoGrouped) {
      if (row.jenisSimpanan === JenisSimpanan.POKOK) {
        komposisiSimpanan.pokok = this.toNumber(row._sum.saldoBerjalan);
      }
      if (row.jenisSimpanan === JenisSimpanan.WAJIB) {
        komposisiSimpanan.wajib = this.toNumber(row._sum.saldoBerjalan);
      }
      if (row.jenisSimpanan === JenisSimpanan.SUKARELA) {
        komposisiSimpanan.sukarela = this.toNumber(row._sum.saldoBerjalan);
      }
    }

    const totalSimpanan =
      komposisiSimpanan.pokok +
      komposisiSimpanan.wajib +
      komposisiSimpanan.sukarela;
    const pinjamanOutstanding = this.toNumber(
      totalOutstandingAgg._sum.sisaPinjaman,
    );

    const previousSimpanan = Math.max(
      0,
      totalSimpanan - currentNominal.SETORAN + currentNominal.PENARIKAN,
    );
    const previousAktifNasabah = Math.max(
      0,
      aktifNasabah - nasabahBaru + nasabahKeluar,
    );

    const performance = {
      simpanan: this.calculateGrowth(totalSimpanan, previousSimpanan),
      transaksi: this.calculateGrowth(
        currentTotalTransaksi,
        previousTotalTransaksi,
      ),
      anggota: this.calculateGrowth(aktifNasabah, previousAktifNasabah),
    };

    const cashflowTrend = cashflowTrendRows
      .map((row) => ({
        year: row.year,
        month: row.month,
        bulan: this.formatMonthLabel(row.month, row.year),
        kasMasuk: this.toNumber(row.kasMasuk),
        kasKeluar: this.toNumber(row.kasKeluar),
      }))
      .filter((row) => row.kasMasuk !== 0 || row.kasKeluar !== 0)
      .sort((a, b) => (a.year - b.year) * 12 + (a.month - b.month))
      .map(({ bulan: monthLabel, kasMasuk, kasKeluar }) => ({
        bulan: monthLabel,
        kasMasuk,
        kasKeluar,
      }));

    const trenKeanggotaan = keanggotaanTrendRows
      .map((row) => ({
        year: row.year,
        month: row.month,
        bulan: this.formatMonthLabel(row.month, row.year),
        anggotaBaru: this.toNumber(row.anggotaBaru),
        anggotaKeluar: this.toNumber(row.anggotaKeluar),
      }))
      .filter((row) => row.anggotaBaru !== 0 || row.anggotaKeluar !== 0)
      .sort((a, b) => (a.year - b.year) * 12 + (a.month - b.month))
      .map(({ bulan: monthLabel, anggotaBaru, anggotaKeluar }) => ({
        bulan: monthLabel,
        anggotaBaru,
        anggotaKeluar,
      }));

    const kasMasukBulanIni = currentNominal.SETORAN + currentNominal.ANGSURAN;
    const kasKeluarBulanIni =
      currentNominal.PENARIKAN + currentNominal.PENCAIRAN;

    const cashflow: 'surplus' | 'defisit' =
      kasMasukBulanIni >= kasKeluarBulanIni ? 'surplus' : 'defisit';

    const negatifCount = [
      performance.simpanan,
      performance.transaksi,
      performance.anggota,
    ].filter((value) => value < 0).length;
    let kondisi: 'stabil' | 'belum stabil' | 'berisiko' = 'belum stabil';
    if (cashflow === 'surplus' && negatifCount <= 1) {
      kondisi = 'stabil';
    } else if (cashflow === 'defisit' && negatifCount >= 2) {
      kondisi = 'berisiko';
    }

    return {
      periode: { bulan, tahun },
      ringkasanKeuangan: {
        simpanan: totalSimpanan,
        pinjamanOutstanding,
        angsuranBulanIni: currentNominal.ANGSURAN,
        penarikanBulanIni: currentNominal.PENARIKAN,
        komposisiSimpanan,
      },
      performance,
      aktivitasTransaksi: {
        cashflowTrend,
      },
      kreditPinjaman: {
        topOutstanding: topOutstanding.map((item) => ({
          pinjamanId: item.id,
          namaAnggota: item.nasabah.nama,
          nominal: this.toNumber(item.sisaPinjaman),
        })),
      },
      keanggotaan: {
        total: totalNasabah,
        aktif: aktifNasabah,
        tren: trenKeanggotaan,
      },
      highlight: {
        cashflow,
        kondisi,
      },
    };
  }
}
