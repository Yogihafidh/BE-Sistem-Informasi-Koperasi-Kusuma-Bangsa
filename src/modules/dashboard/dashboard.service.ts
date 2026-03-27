import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JenisSimpanan,
  JenisTransaksi,
  NasabahStatus,
  Prisma,
} from '@prisma/client';
import { DashboardRepository } from './dashboard.repository';
import { SettingsService } from '../settings/settings.service';
import { SETTING_KEYS } from '../settings/constants/settings.constants';
import { CacheService } from '../../common/cache/cache.service';

@Injectable()
export class DashboardService {
  private static readonly CACHE_KEY = {
    PREFIX: 'dashboard',
    REGISTRY: 'dashboard:keys',
  } as const;

  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly dashboardRepository: DashboardRepository,
    private readonly settingsService: SettingsService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  private toNumber(value: Prisma.Decimal | number | null | undefined) {
    if (value === null || value === undefined) {
      return 0;
    }
    return value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
  }

  private getMonthRange(bulan: number, tahun: number) {
    const start = new Date(tahun, bulan - 1, 1, 0, 0, 0, 0);
    const end = new Date(tahun, bulan, 0, 23, 59, 59, 999);
    return { start, end };
  }

  private shiftMonth(bulan: number, tahun: number, offset: number) {
    const date = new Date(tahun, bulan - 1, 1);
    date.setMonth(date.getMonth() + offset);
    return { bulan: date.getMonth() + 1, tahun: date.getFullYear() };
  }

  private calculateGrowth(current: number, previous: number) {
    if (previous <= 0) {
      return null;
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

  private getCacheKey(bulan: number, tahun: number) {
    return `${DashboardService.CACHE_KEY.PREFIX}:${tahun}:${bulan}`;
  }

  private getCacheTtlSeconds() {
    return (
      this.configService.get<number>('app.cacheTtlDashboardSeconds') ?? 600
    );
  }

  async clearDashboardCache(): Promise<void> {
    await this.cacheService.clearRegisteredKeys(
      DashboardService.CACHE_KEY.REGISTRY,
    );
  }

  async invalidateDashboardBecauseFinancialChanged(
    source = 'unknown',
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    try {
      await this.clearDashboardCache();
      this.logger.log({
        event: 'dashboard.invalidate',
        source,
        timestamp,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn({
        event: 'dashboard.invalidate.failed',
        source,
        timestamp,
        error: errorMessage,
      });
    }
  }

  async getDashboard(bulan: number, tahun: number) {
    const cached = await this.cacheService.getJson<Record<string, unknown>>(
      this.getCacheKey(bulan, tahun),
    );
    if (cached) {
      return cached;
    }

    const trendMonthsSetting = await this.settingsService.getNumber(
      SETTING_KEYS.DASHBOARD_TREND_MONTHS,
    );
    const trendMonths = Math.max(1, Math.floor(trendMonthsSetting));

    const { start, end } = this.getMonthRange(bulan, tahun);
    const snapshot =
      await this.dashboardRepository.findLaporanKeuanganByPeriode(bulan, tahun);

    const [
      totalSimpananAgg,
      totalOutstandingAgg,
      setoranAgg,
      penarikanAgg,
      angsuranAgg,
      saldoGrouped,
      topOutstanding,
      totalAnggota,
      anggotaAktif,
    ] = await Promise.all([
      this.dashboardRepository.sumSaldoSimpanan(),
      this.dashboardRepository.sumPinjamanAktifNominal(),
      this.dashboardRepository.sumTransaksiNominal({
        jenisTransaksi: JenisTransaksi.SETORAN,
        tanggalFrom: start,
        tanggalTo: end,
      }),
      this.dashboardRepository.sumTransaksiNominal({
        jenisTransaksi: JenisTransaksi.PENARIKAN,
        tanggalFrom: start,
        tanggalTo: end,
      }),
      this.dashboardRepository.sumTransaksiNominal({
        jenisTransaksi: JenisTransaksi.ANGSURAN,
        tanggalFrom: start,
        tanggalTo: end,
      }),
      this.dashboardRepository.groupSaldoSimpananByJenis(),
      this.dashboardRepository.listTopOutstandingPinjaman(5),
      this.dashboardRepository.countNasabah({ deletedAt: null }),
      this.dashboardRepository.countNasabah({
        deletedAt: null,
        status: NasabahStatus.AKTIF,
      }),
    ]);

    const totalSimpanan = this.toNumber(totalSimpananAgg._sum.saldoBerjalan);
    const totalOutstandingPinjaman = this.toNumber(
      totalOutstandingAgg._sum.sisaPinjaman,
    );

    const totalSetoran = snapshot
      ? this.toNumber(snapshot.totalSimpanan)
      : this.toNumber(setoranAgg._sum.nominal);
    const totalPenarikan = snapshot
      ? this.toNumber(snapshot.totalPenarikan)
      : this.toNumber(penarikanAgg._sum.nominal);
    const angsuranBulanIni = snapshot
      ? this.toNumber(snapshot.totalAngsuran)
      : this.toNumber(angsuranAgg._sum.nominal);

    const prevTotalSimpanan = totalSimpanan - (totalSetoran - totalPenarikan);
    const growthSimpanan = this.calculateGrowth(
      totalSimpanan,
      prevTotalSimpanan,
    );

    const komposisiSimpanan: Record<string, number> = {
      [JenisSimpanan.POKOK]: 0,
      [JenisSimpanan.WAJIB]: 0,
      [JenisSimpanan.SUKARELA]: 0,
    };
    for (const row of saldoGrouped) {
      komposisiSimpanan[row.jenisSimpanan] = this.toNumber(
        row._sum.saldoBerjalan,
      );
    }

    const monthRanges = Array.from({ length: trendMonths }, (_, index) => {
      const shifted = this.shiftMonth(bulan, tahun, -(trendMonths - 1 - index));
      return {
        bulan: shifted.bulan,
        tahun: shifted.tahun,
        range: this.getMonthRange(shifted.bulan, shifted.tahun),
      };
    });

    const [cashflowTrend, trenAnggota] = await Promise.all([
      Promise.all(
        monthRanges.map(async (item) => {
          const [kasMasukAgg, kasKeluarAgg] = await Promise.all([
            this.dashboardRepository.sumTransaksiNominal({
              jenisTransaksi: [JenisTransaksi.SETORAN, JenisTransaksi.ANGSURAN],
              tanggalFrom: item.range.start,
              tanggalTo: item.range.end,
            }),
            this.dashboardRepository.sumTransaksiNominal({
              jenisTransaksi: [
                JenisTransaksi.PENARIKAN,
                JenisTransaksi.PENCAIRAN,
              ],
              tanggalFrom: item.range.start,
              tanggalTo: item.range.end,
            }),
          ]);

          return {
            bulan: this.formatMonthLabel(item.bulan, item.tahun),
            kasMasuk: this.toNumber(kasMasukAgg._sum.nominal),
            kasKeluar: this.toNumber(kasKeluarAgg._sum.nominal),
          };
        }),
      ),
      Promise.all(
        monthRanges.map(async (item) => {
          const [anggotaBaru, anggotaKeluar] = await Promise.all([
            this.dashboardRepository.countNasabah({
              deletedAt: null,
              createdAt: { gte: item.range.start, lte: item.range.end },
            }),
            this.dashboardRepository.countNasabah({
              deletedAt: null,
              status: NasabahStatus.NONAKTIF,
              updatedAt: { gte: item.range.start, lte: item.range.end },
            }),
          ]);

          return {
            bulan: this.formatMonthLabel(item.bulan, item.tahun),
            anggotaBaru,
            anggotaKeluar,
          };
        }),
      ),
    ]);

    const topOutstandingValues = topOutstanding.map((item) => ({
      pinjamanId: item.id,
      nominal: this.toNumber(item.sisaPinjaman),
    }));

    const response = {
      message: 'Berhasil mengambil data dashboard',
      data: {
        periode: { bulan, tahun },
        ringkasanKeuangan: {
          totalSimpanan,
          totalOutstandingPinjaman,
          angsuranBulanIni,
          penarikanBulanIni: totalPenarikan,
          growthSimpanan,
          komposisiSimpanan,
        },
        aktivitasTransaksi: {
          cashflowTrend,
        },
        kreditPinjaman: {
          topOutstanding: topOutstandingValues,
        },
        keanggotaan: {
          totalAnggota,
          anggotaAktif,
          trenAnggota,
        },
      },
    };

    await this.cacheService.setJson(
      this.getCacheKey(bulan, tahun),
      response,
      this.getCacheTtlSeconds(),
    );
    await this.cacheService.registerKey(
      DashboardService.CACHE_KEY.REGISTRY,
      this.getCacheKey(bulan, tahun),
    );

    return response;
  }
}
