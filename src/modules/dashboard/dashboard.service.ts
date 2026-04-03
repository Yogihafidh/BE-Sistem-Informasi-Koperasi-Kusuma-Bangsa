import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

  private getRollingMonths(trendMonths: number, now: Date) {
    const months: Array<{ year: number; month: number; label: string }> = [];

    for (let i = trendMonths - 1; i >= 0; i -= 1) {
      const date = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
      );

      months.push({
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        label: this.formatMonthLabel(
          date.getUTCMonth() + 1,
          date.getUTCFullYear(),
        ),
      });
    }

    return months;
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

  async getDashboard() {
    const trendMonthsSetting = await this.settingsService.getNumber(
      SETTING_KEYS.DASHBOARD_TREND_MONTHS,
    );
    const trendMonths = Math.max(1, Math.floor(trendMonthsSetting));
    const now = new Date();
    const rollingMonths = this.getRollingMonths(trendMonths, now);

    const trendRange = {
      startMonth: new Date(
        Date.UTC(rollingMonths[0].year, rollingMonths[0].month - 1, 1),
      ),
      endMonth: new Date(
        Date.UTC(
          rollingMonths.at(-1)!.year,
          rollingMonths.at(-1)!.month - 1,
          1,
        ),
      ),
    };

    const [
      saldoAgg,
      totalOutstandingAgg,
      topOutstanding,
      totalNasabah,
      aktifNasabah,
      cashflowTrendRows,
      keanggotaanTrendRows,
    ] = await Promise.all([
      this.dashboardRepository.sumSaldoSimpanan(),
      this.dashboardRepository.sumPinjamanAktifNominal(),
      this.dashboardRepository.listTopOutstandingPinjaman(5),
      this.dashboardRepository.countNasabahTotal(),
      this.dashboardRepository.countNasabahAktif(),
      this.dashboardRepository.getCashflowTrend({
        startMonth: trendRange.startMonth,
        endMonth: trendRange.endMonth,
      }),
      this.dashboardRepository.getKeanggotaanTrend({
        startMonth: trendRange.startMonth,
        endMonth: trendRange.endMonth,
      }),
    ]);

    const totalSimpanan = this.toNumber(saldoAgg._sum.saldoBerjalan);
    const totalPinjamanOutstanding = this.toNumber(
      totalOutstandingAgg._sum.sisaPinjaman,
    );

    const cashflowTrendMap = new Map(
      cashflowTrendRows.map((row) => [
        `${row.year}-${String(row.month).padStart(2, '0')}`,
        {
          kasMasuk: this.toNumber(row.kasMasuk),
          kasKeluar: this.toNumber(row.kasKeluar),
        },
      ]),
    );

    const cashflowTrend = rollingMonths.map((month) => {
      const key = `${month.year}-${String(month.month).padStart(2, '0')}`;
      const value = cashflowTrendMap.get(key);

      return {
        bulan: month.label,
        kasMasuk: value?.kasMasuk ?? 0,
        kasKeluar: value?.kasKeluar ?? 0,
      };
    });

    const keanggotaanTrendMap = new Map(
      keanggotaanTrendRows.map((row) => [
        `${row.year}-${String(row.month).padStart(2, '0')}`,
        {
          anggotaBaru: this.toNumber(row.anggotaBaru),
          anggotaKeluar: this.toNumber(row.anggotaKeluar),
        },
      ]),
    );

    const trenKeanggotaan = rollingMonths
      .map((row) => ({
        key: `${row.year}-${String(row.month).padStart(2, '0')}`,
        bulan: row.label,
      }))
      .map((row) => ({
        bulan: row.bulan,
        anggotaBaru: keanggotaanTrendMap.get(row.key)?.anggotaBaru ?? 0,
        anggotaKeluar: keanggotaanTrendMap.get(row.key)?.anggotaKeluar ?? 0,
      }));

    const payload = {
      context: {
        generatedAt: now.toISOString(),
      },
      ringkasanUtama: {
        totalSimpanan,
        totalPinjamanOutstanding,
        totalAnggota: totalNasabah,
        anggotaAktif: aktifNasabah,
      },
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
        tren: trenKeanggotaan,
      },
    };

    return payload;
  }
}
