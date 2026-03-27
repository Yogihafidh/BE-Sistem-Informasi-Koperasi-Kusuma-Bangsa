import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JenisSimpanan,
  JenisTransaksi,
  LaporanKeuangan,
  NasabahStatus,
  Prisma,
  StatusLaporan,
} from '@prisma/client';
import { LaporanRepository } from './laporan.repository';
import { CacheService } from '../../common/cache/cache.service';
import { DashboardService } from '../dashboard/dashboard.service';

@Injectable()
export class LaporanService {
  private readonly logger = new Logger(LaporanService.name);

  private static readonly CACHE_KEY = {
    REKAPITULASI_PREFIX: 'laporan',
    KEUANGAN_SNAPSHOT_PREFIX: 'laporan:keuangan:snapshot',
    KEUANGAN_LATEST: 'laporan:keuangan:latest',
    // Backward compatibility for older key shape before snapshot refactor.
    KEUANGAN_LEGACY_PREFIX: 'laporan:keuangan',
  } as const;

  constructor(
    private readonly laporanRepository: LaporanRepository,
    private readonly cacheService: CacheService,
    @Inject(DashboardService)
    private readonly dashboardService: {
      invalidateDashboardBecauseFinancialChanged: (
        source?: string,
      ) => Promise<void>;
    },
    private readonly configService: ConfigService,
  ) {}

  private getCacheKey(type: string, bulan: number, tahun: number) {
    return `${LaporanService.CACHE_KEY.REKAPITULASI_PREFIX}:${type}:${tahun}:${bulan}`;
  }

  private getKeuanganSnapshotKey(bulan: number, tahun: number) {
    return `${LaporanService.CACHE_KEY.KEUANGAN_SNAPSHOT_PREFIX}:${tahun}:${bulan}`;
  }

  private getKeuanganLatestKey() {
    return LaporanService.CACHE_KEY.KEUANGAN_LATEST;
  }

  private getLegacyKeuanganKey(bulan: number, tahun: number) {
    return `${LaporanService.CACHE_KEY.KEUANGAN_LEGACY_PREFIX}:${tahun}:${bulan}`;
  }

  private async invalidateKeuanganSnapshotCache(bulan: number, tahun: number) {
    const keys = [
      this.getKeuanganSnapshotKey(bulan, tahun),
      this.getKeuanganLatestKey(),
      this.getLegacyKeuanganKey(bulan, tahun),
    ];

    for (const key of keys) {
      await this.cacheService.del(key);
      this.logger.log(`Cache invalidated: ${key}`);
    }
  }

  private getCacheTtlSeconds() {
    return this.configService.get<number>('app.cacheTtlLaporanSeconds') ?? 900;
  }

  private isRealtimeRekapitulasiKey(key: string) {
    return (
      key.startsWith('laporan:bulanan:') ||
      key.startsWith('laporan:transaksi:') ||
      key.startsWith('laporan:angsuran:') ||
      key.startsWith('laporan:penarikan:') ||
      key.startsWith('laporan:pinjaman:') ||
      key.startsWith('laporan:simpanan:') ||
      key.startsWith('laporan:cashflow:') ||
      key.startsWith('laporan:anggota:')
    );
  }

  private async cacheResponse<T>(key: string, loader: () => Promise<T>) {
    // Rekapitulasi harus real-time, jadi jangan ambil/isi cache untuk key ini.
    if (this.isRealtimeRekapitulasiKey(key)) {
      return loader();
    }

    const cached = await this.cacheService.getJson<T>(key);
    if (cached) {
      return cached;
    }

    const response = await loader();
    await this.cacheService.setJson(key, response, this.getCacheTtlSeconds());
    return response;
  }

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

  private subtractMonths(date: Date, months: number) {
    const copy = new Date(date);
    copy.setMonth(copy.getMonth() - months);
    return copy;
  }

  private async getSaldoAwal(bulan: number, tahun: number) {
    const previous = await this.laporanRepository.findPreviousFinalLaporan(
      bulan,
      tahun,
    );
    return this.toNumber(previous?.saldoAkhir ?? 0);
  }

  private buildJenisMap<T>(keys: JenisTransaksi[], factory: () => T) {
    return keys.reduce<Record<string, T>>((acc, key) => {
      acc[key] = factory();
      return acc;
    }, {});
  }

  private safeDivide(numerator: number, denominator: number) {
    if (denominator <= 0) {
      return null;
    }
    return numerator / denominator;
  }

  private calculateGrowth(current: number, previous: number) {
    if (previous <= 0) {
      return null;
    }
    return (current - previous) / previous;
  }

  private formatGrowth(value: number | null) {
    return (
      value ??
      'Tidak ada data bulan sebelumnya sehingga growth tidak dapat dihitung'
    );
  }

  private formatNullableMetric(value: number | null) {
    return (
      value ??
      'Tidak dapat dihitung karena data pembagi tidak tersedia atau bernilai 0'
    );
  }

  private roundTo(value: number, decimals: number) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }

  private ratioOfTotal(value: number, total: number) {
    if (total <= 0) {
      return null;
    }
    return this.roundTo(value / total, 2);
  }

  private shiftMonth(bulan: number, tahun: number, offset: number) {
    const date = new Date(tahun, bulan - 1, 1);
    date.setMonth(date.getMonth() + offset);
    return { bulan: date.getMonth() + 1, tahun: date.getFullYear() };
  }

  private getTransaksiTrend(
    current: number,
    prev: number,
    prev2: number,
  ): 'NAIK' | 'TURUN' | 'STABIL' {
    if (current > prev && prev > prev2) {
      return 'NAIK';
    }
    if (current < prev && prev < prev2) {
      return 'TURUN';
    }
    return 'STABIL';
  }

  private buildRatioKpi(value: number | null, status: string) {
    return { value, status };
  }

  private getLikuiditasStatus(value: number | null) {
    if (value === null) {
      return 'N/A';
    }
    if (value > 1.5) {
      return 'SEHAT';
    }
    if (value >= 1) {
      return 'WASPADA';
    }
    return 'RISIKO';
  }

  private getKreditAktifStatus(value: number | null) {
    if (value === null) {
      return 'N/A';
    }
    if (value < 0.7) {
      return 'AMAN';
    }
    if (value <= 0.9) {
      return 'TINGGI';
    }
    return 'AGRESIF';
  }

  private getPembayaranStatus(value: number | null) {
    if (value === null) {
      return 'N/A';
    }
    if (value > 0.08) {
      return 'LANCAR';
    }
    if (value >= 0.04) {
      return 'MONITORING';
    }
    return 'RISIKO';
  }

  private getNetCashflowStatus(value: number) {
    if (value > 0) {
      return 'SURPLUS';
    }
    if (value === 0) {
      return 'BREAK_EVEN';
    }
    return 'DEFISIT';
  }

  private calculateKpi(args: {
    saldoAkhir: number;
    totalPenarikan: number;
    totalPinjamanAktif: number;
    totalSimpanan: number;
    totalAngsuran: number;
    anggotaBaru: number;
    anggotaKeluar: number;
    totalAnggota: number;
    netCashflow: number;
  }) {
    const rasioLikuiditas = this.safeDivide(
      args.saldoAkhir,
      args.totalPenarikan,
    );
    const rasioKreditAktif = this.safeDivide(
      args.totalPinjamanAktif,
      args.totalSimpanan,
    );
    const rasioPembayaran = this.safeDivide(
      args.totalAngsuran,
      args.totalPinjamanAktif,
    );
    const pertumbuhanAnggota = this.safeDivide(
      args.anggotaBaru - args.anggotaKeluar,
      args.totalAnggota,
    );

    return {
      rasioLikuiditas: this.buildRatioKpi(
        rasioLikuiditas,
        this.getLikuiditasStatus(rasioLikuiditas),
      ),
      rasioKreditAktif: this.buildRatioKpi(
        rasioKreditAktif,
        this.getKreditAktifStatus(rasioKreditAktif),
      ),
      rasioPembayaranLancar: this.buildRatioKpi(
        rasioPembayaran,
        this.getPembayaranStatus(rasioPembayaran),
      ),
      pertumbuhanAnggota: this.buildRatioKpi(
        pertumbuhanAnggota,
        pertumbuhanAnggota === null ? 'N/A' : 'INFO',
      ),
      netCashflow: {
        value: args.netCashflow,
        status: this.getNetCashflowStatus(args.netCashflow),
      },
    };
  }

  async getLaporanBulanan(bulan: number, tahun: number) {
    return this.cacheResponse(
      this.getCacheKey('bulanan:v3', bulan, tahun),
      async () => {
        const { start, end } = this.getMonthRange(bulan, tahun);
        const prev = this.shiftMonth(bulan, tahun, -1);
        const prevRange = this.getMonthRange(prev.bulan, prev.tahun);

        const [snapshotCurrent, snapshotPrev] = await Promise.all([
          this.laporanRepository.findLaporanKeuanganByPeriode(bulan, tahun),
          this.laporanRepository.findLaporanKeuanganByPeriode(
            prev.bulan,
            prev.tahun,
          ),
        ]);

        const [
          transaksiGrouped,
          prevTransaksiGrouped,
          pinjamanAgg,
          totalPinjamanAktifAgg,
          totalSimpananAgg,
          anggotaAktif,
          totalAnggota,
          anggotaBaru,
          anggotaKeluar,
          saldoAwal,
          totalTransaksiAgg,
          prevPinjamanAgg,
          prevTotalAnggota,
          totalPencairanAgg,
          prevTransaksiAgg,
        ] = await Promise.all([
          snapshotCurrent
            ? Promise.resolve(null)
            : this.laporanRepository.groupTransaksiByJenis({
                tanggalFrom: start,
                tanggalTo: end,
              }),
          snapshotPrev
            ? Promise.resolve(null)
            : this.laporanRepository.groupTransaksiByJenis({
                tanggalFrom: prevRange.start,
                tanggalTo: prevRange.end,
              }),
          snapshotCurrent
            ? Promise.resolve(null)
            : this.laporanRepository.aggregatePinjamanPeriode({
                tanggalFrom: start,
                tanggalTo: end,
              }),
          this.laporanRepository.sumPinjamanAktifNominal(),
          this.laporanRepository.sumSaldoSimpanan(),
          this.laporanRepository.countNasabah({
            deletedAt: null,
            status: NasabahStatus.AKTIF,
          }),
          this.laporanRepository.countNasabah({
            deletedAt: null,
          }),
          this.laporanRepository.countNasabah({
            deletedAt: null,
            createdAt: { gte: start, lte: end },
          }),
          this.laporanRepository.countNasabah({
            deletedAt: null,
            status: NasabahStatus.NONAKTIF,
            updatedAt: { gte: start, lte: end },
          }),
          this.getSaldoAwal(bulan, tahun),
          this.laporanRepository.countTransaksi({
            tanggalFrom: start,
            tanggalTo: end,
          }),
          snapshotPrev
            ? Promise.resolve(null)
            : this.laporanRepository.aggregatePinjamanPeriode({
                tanggalFrom: prevRange.start,
                tanggalTo: prevRange.end,
              }),
          this.laporanRepository.countNasabah({
            deletedAt: null,
            createdAt: { lte: prevRange.end },
          }),
          snapshotCurrent
            ? this.laporanRepository.sumTransaksiNominal({
                jenisTransaksi: JenisTransaksi.PENCAIRAN,
                tanggalFrom: start,
                tanggalTo: end,
              })
            : Promise.resolve(null),
          this.laporanRepository.countTransaksi({
            tanggalFrom: prevRange.start,
            tanggalTo: prevRange.end,
          }),
        ]);

        const mapTransaksiGrouped = (
          grouped: Array<{
            jenisTransaksi: JenisTransaksi;
            _sum: { nominal: Prisma.Decimal | null };
            _count: { _all: number };
          }>,
        ) => {
          const totals: Record<JenisTransaksi, { sum: number; count: number }> =
            {
              [JenisTransaksi.SETORAN]: { sum: 0, count: 0 },
              [JenisTransaksi.PENARIKAN]: { sum: 0, count: 0 },
              [JenisTransaksi.PENCAIRAN]: { sum: 0, count: 0 },
              [JenisTransaksi.ANGSURAN]: { sum: 0, count: 0 },
            };

          for (const row of grouped) {
            totals[row.jenisTransaksi] = {
              sum: this.toNumber(row._sum.nominal),
              count: row._count._all,
            };
          }

          const totalCount = grouped.reduce(
            (acc, row) => acc + row._count._all,
            0,
          );

          return { totals, totalCount };
        };

        const currentTransaksi = transaksiGrouped
          ? mapTransaksiGrouped(transaksiGrouped)
          : null;
        const prevTransaksi = prevTransaksiGrouped
          ? mapTransaksiGrouped(prevTransaksiGrouped)
          : null;

        const totalSimpananMasuk = snapshotCurrent
          ? this.toNumber(snapshotCurrent.totalSimpanan)
          : (currentTransaksi?.totals[JenisTransaksi.SETORAN].sum ?? 0);
        const totalAngsuranDiterima = snapshotCurrent
          ? this.toNumber(snapshotCurrent.totalAngsuran)
          : (currentTransaksi?.totals[JenisTransaksi.ANGSURAN].sum ?? 0);
        const totalPenarikan = snapshotCurrent
          ? this.toNumber(snapshotCurrent.totalPenarikan)
          : (currentTransaksi?.totals[JenisTransaksi.PENARIKAN].sum ?? 0);
        const totalPencairan = snapshotCurrent
          ? this.toNumber(totalPencairanAgg?._sum.nominal)
          : (currentTransaksi?.totals[JenisTransaksi.PENCAIRAN].sum ?? 0);
        const totalPinjamanDiberikan = snapshotCurrent
          ? this.toNumber(snapshotCurrent.totalPinjaman)
          : this.toNumber(pinjamanAgg?._sum.jumlahPinjaman);
        const totalPinjamanAktif = this.toNumber(
          totalPinjamanAktifAgg._sum.sisaPinjaman,
        );
        const totalSimpanan = this.toNumber(
          totalSimpananAgg._sum.saldoBerjalan,
        );
        const totalTransaksi = totalTransaksiAgg._count._all;

        const pemasukan = totalSimpananMasuk + totalAngsuranDiterima;
        const pengeluaran = totalPenarikan + totalPencairan;
        const saldoAkhir = snapshotCurrent
          ? this.toNumber(snapshotCurrent.saldoAkhir)
          : saldoAwal + pemasukan - pengeluaran;
        const netCashflow = pemasukan - pengeluaran;

        const prevTotalSimpananMasuk = snapshotPrev
          ? this.toNumber(snapshotPrev.totalSimpanan)
          : (prevTransaksi?.totals[JenisTransaksi.SETORAN].sum ?? 0);
        const prevTotalPinjaman = snapshotPrev
          ? this.toNumber(snapshotPrev.totalPinjaman)
          : this.toNumber(prevPinjamanAgg?._sum.jumlahPinjaman);
        const prevTotalTransaksi = prevTransaksiAgg._count._all;
        const growthSimpanan = this.calculateGrowth(
          totalSimpananMasuk,
          prevTotalSimpananMasuk,
        );
        const growthPinjaman = this.calculateGrowth(
          totalPinjamanDiberikan,
          prevTotalPinjaman,
        );
        const growthTransaksi = this.calculateGrowth(
          totalTransaksi,
          prevTotalTransaksi,
        );
        const growthAnggota = this.calculateGrowth(
          totalAnggota,
          prevTotalAnggota,
        );

        const rasioLikuiditas = this.safeDivide(saldoAkhir, totalPenarikan);
        const rasioCashCoverage = this.safeDivide(
          totalAngsuranDiterima,
          totalPencairan,
        );
        const rasioKreditAktif = this.safeDivide(
          totalPinjamanAktif,
          totalSimpanan,
        );

        const rasioKeaktifan = this.safeDivide(anggotaAktif, totalAnggota);
        const rasioKeaktifanAnggota = rasioKeaktifan;

        return {
          message: 'Berhasil mengambil laporan bulanan',
          data: {
            periode: { bulan, tahun },
            summary: {
              totalSimpananMasuk,
              totalPinjamanDiberikan,
              totalAngsuranDiterima,
              totalPenarikan,
              saldoAwal,
              saldoAkhir,
              anggotaAktif,
              totalAnggota,
              anggotaBaru,
              anggotaKeluar,
            },
            performance: {
              growthSimpanan: this.formatGrowth(growthSimpanan),
              growthPinjaman: this.formatGrowth(growthPinjaman),
              growthTransaksi: this.formatGrowth(growthTransaksi),
              growthAnggota: this.formatGrowth(growthAnggota),
              netCashflow,
            },
            financialIndicators: {
              rasioLikuiditas,
              rasioKreditAktif,
              rasioCashCoverage,
              rasioKeaktifanAnggota,
            },
          },
        };
      },
    );
  }

  async getLaporanTransaksi(bulan: number, tahun: number) {
    return this.cacheResponse(
      this.getCacheKey('transaksi', bulan, tahun),
      async () => {
        const { start, end } = this.getMonthRange(bulan, tahun);
        const allJenis = Object.values(JenisTransaksi) as JenisTransaksi[];
        const grouped = await this.laporanRepository.getTransaksiSummaryByJenis(
          {
            tanggalFrom: start,
            tanggalTo: end,
          },
        );
        const totalTransaksi = grouped.length
          ? Number(grouped[0]?.total_count ?? 0)
          : 0;
        const totalNominal = grouped.length
          ? this.toNumber(grouped[0]?.total_nominal ?? 0)
          : 0;
        const daysInMonth = end.getDate();
        const rataRataPerHari = this.safeDivide(totalTransaksi, daysInMonth);

        const jenisMap = this.buildJenisMap(allJenis, () => ({
          jumlah: 0,
          total: 0,
          rataRataNominal: null as number | null,
          persentaseDariTotalNominal: null as number | null,
        }));

        for (const row of grouped) {
          const totalJenis = this.toNumber(row.total);
          const jumlahJenis = Number(row.jumlah);
          jenisMap[row.jenisTransaksi] = {
            jumlah: jumlahJenis,
            total: totalJenis,
            rataRataNominal: this.safeDivide(totalJenis, jumlahJenis),
            persentaseDariTotalNominal: this.ratioOfTotal(
              totalJenis,
              totalNominal,
            ),
          };
        }

        return {
          message: 'Berhasil mengambil laporan transaksi',
          data: {
            periode: { bulan, tahun },
            summary: {
              totalTransaksi,
              totalNominal,
              rataRataPerHari,
            },
            breakdown: jenisMap,
          },
        };
      },
    );
  }

  async getLaporanAngsuran(bulan: number, tahun: number) {
    return this.cacheResponse(
      this.getCacheKey('angsuran:v2', bulan, tahun),
      async () => {
        const { start, end } = this.getMonthRange(bulan, tahun);
        const totalAgg = await this.laporanRepository.sumTransaksiNominal({
          jenisTransaksi: JenisTransaksi.ANGSURAN,
          tanggalFrom: start,
          tanggalTo: end,
        });
        const countAgg = await this.laporanRepository.countTransaksi({
          jenisTransaksi: JenisTransaksi.ANGSURAN,
          tanggalFrom: start,
          tanggalTo: end,
        });
        const totalPinjamanAktifAgg =
          await this.laporanRepository.sumPinjamanAktifNominal();
        const totalPencairanAgg =
          await this.laporanRepository.sumTransaksiNominal({
            jenisTransaksi: JenisTransaksi.PENCAIRAN,
            tanggalFrom: start,
            tanggalTo: end,
          });
        const jumlahPeminjam =
          await this.laporanRepository.countDistinctNasabahTransaksi({
            jenisTransaksi: JenisTransaksi.ANGSURAN,
            tanggalFrom: start,
            tanggalTo: end,
          });

        const totalAngsuranMasuk = this.toNumber(totalAgg._sum.nominal);
        const jumlahTransaksi = countAgg._count._all;
        const totalPinjamanAktif = this.toNumber(
          totalPinjamanAktifAgg._sum.sisaPinjaman,
        );
        const totalPencairanBulanIni = this.toNumber(
          totalPencairanAgg._sum.nominal,
        );
        const rataRataAngsuran = this.safeDivide(
          totalAngsuranMasuk,
          jumlahTransaksi,
        );
        const rasioPembayaranLancar = this.safeDivide(
          totalAngsuranMasuk,
          totalPinjamanAktif,
        );
        const coverageTerhadapPencairan = this.safeDivide(
          totalAngsuranMasuk,
          totalPencairanBulanIni,
        );
        const rataRataPerPeminjam = this.safeDivide(
          totalAngsuranMasuk,
          jumlahPeminjam,
        );

        return {
          message: 'Berhasil mengambil laporan angsuran',
          data: {
            periode: { bulan, tahun },
            summary: {
              totalAngsuranMasuk,
              jumlahTransaksi,
              rataRataAngsuran: this.formatNullableMetric(rataRataAngsuran),
            },
            metrics: {
              rasioPembayaranLancar: this.formatNullableMetric(
                rasioPembayaranLancar,
              ),
              coverageTerhadapPencairan: this.formatNullableMetric(
                coverageTerhadapPencairan,
              ),
              rataRataPerPeminjam:
                this.formatNullableMetric(rataRataPerPeminjam),
            },
          },
        };
      },
    );
  }

  async getLaporanPenarikan(bulan: number, tahun: number) {
    return this.cacheResponse(
      this.getCacheKey('penarikan:v2', bulan, tahun),
      async () => {
        const { start, end } = this.getMonthRange(bulan, tahun);
        const totalAgg = await this.laporanRepository.sumTransaksiNominal({
          jenisTransaksi: JenisTransaksi.PENARIKAN,
          tanggalFrom: start,
          tanggalTo: end,
        });
        const totalCount = await this.laporanRepository.countTransaksi({
          jenisTransaksi: JenisTransaksi.PENARIKAN,
          tanggalFrom: start,
          tanggalTo: end,
        });
        const totalSimpananAgg =
          await this.laporanRepository.sumSaldoSimpanan();
        const topNasabahNominal =
          await this.laporanRepository.topNasabahByNominal({
            jenisTransaksi: JenisTransaksi.PENARIKAN,
            tanggalFrom: start,
            tanggalTo: end,
            take: 3,
          });

        const totalPenarikan = this.toNumber(totalAgg._sum.nominal);
        const jumlahTransaksi = totalCount._count._all;
        const totalSimpanan = this.toNumber(
          totalSimpananAgg._sum.saldoBerjalan,
        );
        const rataRataPenarikan = this.safeDivide(
          totalPenarikan,
          jumlahTransaksi,
        );
        const rasioTerhadapSimpanan = this.safeDivide(
          totalPenarikan,
          totalSimpanan,
        );

        const { start: prevStart, end: prevEnd } = this.getMonthRange(
          bulan === 1 ? 12 : bulan - 1,
          bulan === 1 ? tahun - 1 : tahun,
        );
        const prevAgg = await this.laporanRepository.sumTransaksiNominal({
          jenisTransaksi: JenisTransaksi.PENARIKAN,
          tanggalFrom: prevStart,
          tanggalTo: prevEnd,
        });
        const prevTotal = this.toNumber(prevAgg._sum.nominal);
        const pertumbuhanDariBulanLalu = this.calculateGrowth(
          totalPenarikan,
          prevTotal,
        );

        const top3Total = topNasabahNominal.reduce((acc, row) => {
          return acc + this.toNumber(row._sum.nominal);
        }, 0);
        const konsentrasiTop3 = this.safeDivide(top3Total, totalPenarikan);

        return {
          message: 'Berhasil mengambil laporan penarikan',
          data: {
            periode: { bulan, tahun },
            summary: {
              totalPenarikan,
              jumlahTransaksi,
              rataRataPenarikan: this.formatNullableMetric(rataRataPenarikan),
            },
            metrics: {
              rasioTerhadapSimpanan: this.formatNullableMetric(
                rasioTerhadapSimpanan,
              ),
              pertumbuhanDariBulanLalu: this.formatGrowth(
                pertumbuhanDariBulanLalu,
              ),
              konsentrasiTop3: this.formatNullableMetric(konsentrasiTop3),
            },
          },
        };
      },
    );
  }

  async getLaporanPinjaman(bulan: number, tahun: number) {
    return this.cacheResponse(
      this.getCacheKey('pinjaman:v2', bulan, tahun),
      async () => {
        const { start, end } = this.getMonthRange(bulan, tahun);
        const totalPinjamanAktif =
          await this.laporanRepository.countPinjamanAktif();
        const totalPinjamanAktifAgg =
          await this.laporanRepository.sumPinjamanAktifNominal();
        const pinjamanBaru = await this.laporanRepository.countPinjamanBaru({
          tanggalFrom: start,
          tanggalTo: end,
        });
        const totalSimpananAgg =
          await this.laporanRepository.sumSaldoSimpanan();
        const topOutstanding =
          await this.laporanRepository.listTopOutstandingPinjaman(5);

        const totalOutstanding = this.toNumber(
          totalPinjamanAktifAgg._sum.sisaPinjaman,
        );
        const totalSimpanan = this.toNumber(
          totalSimpananAgg._sum.saldoBerjalan,
        );
        const rasioPinjamanTerhadapSimpanan = this.safeDivide(
          totalOutstanding,
          totalSimpanan,
        );
        const top5Outstanding = topOutstanding.reduce((acc, item) => {
          return acc + this.toNumber(item.sisaPinjaman);
        }, 0);
        const konsentrasiTop5 = this.safeDivide(
          top5Outstanding,
          totalOutstanding,
        );
        const rataRataOutstanding = this.safeDivide(
          totalOutstanding,
          totalPinjamanAktif,
        );

        return {
          message: 'Berhasil mengambil laporan pinjaman',
          data: {
            periode: { bulan, tahun },
            summary: {
              totalPinjamanAktif,
              totalOutstanding,
              pinjamanBaru,
            },
            metrics: {
              rasioPinjamanTerhadapSimpanan: this.formatNullableMetric(
                rasioPinjamanTerhadapSimpanan,
              ),
              konsentrasiTop5: this.formatNullableMetric(konsentrasiTop5),
              rataRataOutstanding:
                this.formatNullableMetric(rataRataOutstanding),
            },
          },
        };
      },
    );
  }

  async getLaporanSimpanan(bulan: number, tahun: number) {
    return this.cacheResponse(
      this.getCacheKey('simpanan:v2', bulan, tahun),
      async () => {
        const { start, end } = this.getMonthRange(bulan, tahun);
        const saldoGrouped =
          await this.laporanRepository.groupSaldoSimpananByJenis();
        const totalSimpananAgg =
          await this.laporanRepository.sumSaldoSimpanan();
        const setoranAgg = await this.laporanRepository.sumTransaksiNominal({
          jenisTransaksi: JenisTransaksi.SETORAN,
          tanggalFrom: start,
          tanggalTo: end,
        });
        const penarikanAgg = await this.laporanRepository.sumTransaksiNominal({
          jenisTransaksi: JenisTransaksi.PENARIKAN,
          tanggalFrom: start,
          tanggalTo: end,
        });
        const anggotaAktif = await this.laporanRepository.countNasabah({
          deletedAt: null,
          status: NasabahStatus.AKTIF,
        });

        const saldoMap: Record<string, number> = {
          [JenisSimpanan.POKOK]: 0,
          [JenisSimpanan.WAJIB]: 0,
          [JenisSimpanan.SUKARELA]: 0,
        };

        for (const row of saldoGrouped) {
          saldoMap[row.jenisSimpanan] = this.toNumber(row._sum.saldoBerjalan);
        }

        const totalSimpanan = this.toNumber(
          totalSimpananAgg._sum.saldoBerjalan,
        );
        const totalSetoran = this.toNumber(setoranAgg._sum.nominal);
        const totalPenarikan = this.toNumber(penarikanAgg._sum.nominal);
        const prevTotal = totalSimpanan - (totalSetoran - totalPenarikan);
        const growthSimpanan = this.calculateGrowth(totalSimpanan, prevTotal);
        const rasioSukarela = this.safeDivide(
          saldoMap[JenisSimpanan.SUKARELA],
          totalSimpanan,
        );
        const rataRataSaldoAnggota = this.safeDivide(
          totalSimpanan,
          anggotaAktif,
        );

        return {
          message: 'Berhasil mengambil laporan simpanan',
          data: {
            periode: { bulan, tahun },
            summary: {
              totalSimpanan,
              simpananPokok: saldoMap[JenisSimpanan.POKOK],
              simpananWajib: saldoMap[JenisSimpanan.WAJIB],
              simpananSukarela: saldoMap[JenisSimpanan.SUKARELA],
            },
            metrics: {
              growthSimpanan: this.formatGrowth(growthSimpanan),
              rasioSukarela: this.formatNullableMetric(rasioSukarela),
              rataRataSaldoAnggota:
                this.formatNullableMetric(rataRataSaldoAnggota),
            },
          },
        };
      },
    );
  }

  async getLaporanCashflow(bulan: number, tahun: number) {
    return this.cacheResponse(
      this.getCacheKey('cashflow:v3', bulan, tahun),
      async () => {
        const { end } = this.getMonthRange(bulan, tahun);
        const prev2 = this.shiftMonth(bulan, tahun, -2);
        const rangeStart = this.getMonthRange(prev2.bulan, prev2.tahun).start;
        const [cashflowRows, saldoAwal] = await Promise.all([
          this.laporanRepository.getCashflowMonthlySummary({
            tanggalFrom: rangeStart,
            tanggalTo: end,
          }),
          this.getSaldoAwal(bulan, tahun),
        ]);

        const monthKey = (year: number, month: number) => `${year}-${month}`;

        const summaryMap = new Map(
          cashflowRows.map((row) => [
            monthKey(row.tahun, row.bulan),
            {
              pemasukan: this.toNumber(row.pemasukan),
              pengeluaran: this.toNumber(row.pengeluaran),
            },
          ]),
        );

        const currentKey = monthKey(tahun, bulan);
        const prev = this.shiftMonth(bulan, tahun, -1);
        const prevKey = monthKey(prev.tahun, prev.bulan);
        const prev2Key = monthKey(prev2.tahun, prev2.bulan);

        const currentSummary = summaryMap.get(currentKey) ?? {
          pemasukan: 0,
          pengeluaran: 0,
        };
        const prevSummary = summaryMap.get(prevKey) ?? {
          pemasukan: 0,
          pengeluaran: 0,
        };
        const prev2Summary = summaryMap.get(prev2Key) ?? {
          pemasukan: 0,
          pengeluaran: 0,
        };

        const pemasukan = currentSummary.pemasukan;
        const pengeluaran = currentSummary.pengeluaran;
        const surplus = pemasukan - pengeluaran;
        const saldoAkhir = saldoAwal + surplus;

        const rasioLikuiditas = this.safeDivide(
          saldoAwal + pemasukan,
          pengeluaran,
        );
        const rasioPengeluaran = this.safeDivide(pengeluaran, pemasukan);

        const prevSurplus = prevSummary.pemasukan - prevSummary.pengeluaran;
        const surplusDelta = surplus - prevSurplus;

        const cashflowAggs = [currentSummary, prevSummary, prev2Summary];
        let defisitBeruntun = 0;
        for (const cashflow of cashflowAggs) {
          const monthlySurplus = cashflow.pemasukan - cashflow.pengeluaran;
          if (monthlySurplus < 0) {
            defisitBeruntun += 1;
          } else {
            break;
          }
        }

        return {
          message: 'Berhasil mengambil laporan cashflow',
          data: {
            periode: { bulan, tahun },
            summary: {
              saldoAwal,
              pemasukan,
              pengeluaran,
              surplus,
              saldoAkhir,
            },
            rasio: {
              rasioLikuiditas: this.formatNullableMetric(rasioLikuiditas),
              rasioPengeluaran: this.formatNullableMetric(rasioPengeluaran),
            },
            tren: {
              surplusDelta,
              defisitBeruntun,
            },
          },
        };
      },
    );
  }

  async getLaporanAnggota(bulan: number, tahun: number) {
    return this.cacheResponse(
      this.getCacheKey('anggota:v2', bulan, tahun),
      async () => {
        const { start, end } = this.getMonthRange(bulan, tahun);

        const [
          totalTerdaftar,
          anggotaAktif,
          anggotaBaru,
          anggotaKeluar,
          anggotaDenganPinjamanAktif,
          totalPinjamanAktifAgg,
          anggotaDenganTransaksi,
        ] = await Promise.all([
          this.laporanRepository.countNasabah({ deletedAt: null }),
          this.laporanRepository.countNasabah({
            deletedAt: null,
            status: NasabahStatus.AKTIF,
          }),
          this.laporanRepository.countNasabah({
            deletedAt: null,
            createdAt: { gte: start, lte: end },
          }),
          this.laporanRepository.countNasabah({
            deletedAt: null,
            status: NasabahStatus.NONAKTIF,
            updatedAt: { gte: start, lte: end },
          }),
          this.laporanRepository.countNasabahWithPinjamanAktif(),
          this.laporanRepository.sumPinjamanAktifNominal(),
          this.laporanRepository.countDistinctNasabahTransaksi({
            jenisTransaksi: Object.values(JenisTransaksi) as JenisTransaksi[],
            tanggalFrom: start,
            tanggalTo: end,
          }),
        ]);
        const totalPinjamanAktif = this.toNumber(
          totalPinjamanAktifAgg._sum.sisaPinjaman,
        );
        const rataRataPinjamanPerAnggota = this.safeDivide(
          totalPinjamanAktif,
          anggotaDenganPinjamanAktif,
        );
        const rasioKeaktifan = this.safeDivide(anggotaAktif, totalTerdaftar);
        const rasioPertumbuhan = this.safeDivide(
          anggotaBaru - anggotaKeluar,
          totalTerdaftar,
        );
        const rasioPartisipasiTransaksi = this.safeDivide(
          anggotaDenganTransaksi,
          anggotaAktif,
        );
        const rasioPinjamanAktif = this.safeDivide(
          anggotaDenganPinjamanAktif,
          anggotaAktif,
        );

        return {
          message: 'Berhasil mengambil laporan anggota',
          data: {
            periode: { bulan, tahun },
            population: {
              totalTerdaftar,
              anggotaAktif,
              anggotaBaru,
              anggotaKeluar,
            },
            kredit: {
              anggotaDenganPinjamanAktif,
              rataRataPinjamanPerAnggota: this.formatNullableMetric(
                rataRataPinjamanPerAnggota,
              ),
            },
            rasio: {
              rasioKeaktifan: this.formatNullableMetric(rasioKeaktifan),
              rasioPertumbuhan: this.formatNullableMetric(rasioPertumbuhan),
              rasioPartisipasiTransaksi: this.formatNullableMetric(
                rasioPartisipasiTransaksi,
              ),
              rasioPinjamanAktif: this.formatNullableMetric(rasioPinjamanAktif),
            },
          },
        };
      },
    );
  }

  private async buildSnapshotTotals(bulan: number, tahun: number) {
    const { start, end } = this.getMonthRange(bulan, tahun);
    const [
      totalSimpananAgg,
      totalPenarikanAgg,
      totalAngsuranAgg,
      totalPencairanAgg,
      totalPinjamanAgg,
      saldoAwal,
    ] = await Promise.all([
      this.laporanRepository.sumTransaksiNominal({
        jenisTransaksi: JenisTransaksi.SETORAN,
        tanggalFrom: start,
        tanggalTo: end,
      }),
      this.laporanRepository.sumTransaksiNominal({
        jenisTransaksi: JenisTransaksi.PENARIKAN,
        tanggalFrom: start,
        tanggalTo: end,
      }),
      this.laporanRepository.sumTransaksiNominal({
        jenisTransaksi: JenisTransaksi.ANGSURAN,
        tanggalFrom: start,
        tanggalTo: end,
      }),
      this.laporanRepository.sumTransaksiNominal({
        jenisTransaksi: JenisTransaksi.PENCAIRAN,
        tanggalFrom: start,
        tanggalTo: end,
      }),
      this.laporanRepository.aggregatePinjamanPeriode({
        tanggalFrom: start,
        tanggalTo: end,
      }),
      this.getSaldoAwal(bulan, tahun),
    ]);

    const totalSimpanan = this.toNumber(totalSimpananAgg._sum.nominal);
    const totalPenarikan = this.toNumber(totalPenarikanAgg._sum.nominal);
    const totalAngsuran = this.toNumber(totalAngsuranAgg._sum.nominal);
    const totalPencairan = this.toNumber(totalPencairanAgg._sum.nominal);
    const totalPinjaman = this.toNumber(totalPinjamanAgg._sum.jumlahPinjaman);

    const pemasukan = totalSimpanan + totalAngsuran;
    const pengeluaran = totalPenarikan + totalPencairan;
    const saldoAkhir = saldoAwal + pemasukan - pengeluaran;

    return {
      totalSimpanan,
      totalPenarikan,
      totalPinjaman,
      totalAngsuran,
      saldoAkhir,
    };
  }

  async generateLaporanKeuangan(bulan: number, tahun: number, userId: number) {
    const existing = await this.laporanRepository.findLaporanKeuanganByPeriode(
      bulan,
      tahun,
    );

    if (existing?.statusLaporan === StatusLaporan.FINAL) {
      throw new BadRequestException('Laporan keuangan sudah FINAL');
    }

    const totals = await this.buildSnapshotTotals(bulan, tahun);
    const generatedAt = new Date();

    const laporan = existing
      ? await this.laporanRepository.updateLaporanKeuangan(existing.id, {
          ...totals,
          generatedAt,
        })
      : await this.laporanRepository.createLaporanKeuangan({
          periodeBulan: bulan,
          periodeTahun: tahun,
          ...totals,
          statusLaporan: StatusLaporan.DRAFT,
          generatedById: userId,
          generatedAt,
        });

    await this.invalidateKeuanganSnapshotCache(bulan, tahun);
    await this.dashboardService.invalidateDashboardBecauseFinancialChanged(
      'laporan:generate',
    );

    return {
      message: 'Laporan keuangan berhasil di-generate',
      data: laporan,
    };
  }

  async getLaporanKeuangan(bulan: number, tahun: number) {
    return this.getLaporanKeuanganSnapshot(bulan, tahun);
  }

  private mapLaporanKeuanganSnapshot(laporan: LaporanKeuangan) {
    const totalSimpanan = this.toNumber(laporan.totalSimpanan);
    const totalAngsuran = this.toNumber(laporan.totalAngsuran);
    const totalPenarikan = this.toNumber(laporan.totalPenarikan);
    const totalPinjaman = this.toNumber(laporan.totalPinjaman);
    const saldoAkhir = this.toNumber(laporan.saldoAkhir);

    const totalPemasukan = totalSimpanan + totalAngsuran;
    const totalPengeluaran = totalPenarikan + totalPinjaman;
    const netCashflow = totalPemasukan - totalPengeluaran;
    const saldoAwal = saldoAkhir - netCashflow;

    return {
      periodeBulan: laporan.periodeBulan,
      periodeTahun: laporan.periodeTahun,
      saldoAwal,
      totalSimpanan,
      totalAngsuran,
      totalPenarikan,
      totalPinjaman,
      totalPemasukan,
      totalPengeluaran,
      netCashflow,
      saldoAkhir,
      statusLaporan: laporan.statusLaporan,
      generatedById: laporan.generatedById,
      generatedAt: laporan.generatedAt.toISOString(),
    };
  }

  private isLaporanKeuanganRecord(value: unknown): value is LaporanKeuangan {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const record = value as Partial<LaporanKeuangan>;
    return (
      typeof record.periodeBulan === 'number' &&
      typeof record.periodeTahun === 'number' &&
      record.generatedAt instanceof Date
    );
  }

  async getLaporanKeuanganSnapshot(bulan?: number, tahun?: number) {
    if ((bulan === undefined) !== (tahun === undefined)) {
      throw new BadRequestException(
        'Parameter bulan dan tahun harus dikirim bersamaan',
      );
    }

    const cacheKey =
      bulan !== undefined && tahun !== undefined
        ? this.getKeuanganSnapshotKey(bulan, tahun)
        : this.getKeuanganLatestKey();

    return this.cacheResponse(cacheKey, async () => {
      let laporanRaw: unknown = null;
      if (bulan !== undefined && tahun !== undefined) {
        laporanRaw = await this.laporanRepository.findLaporanKeuanganByPeriode(
          bulan,
          tahun,
        );
      } else {
        const repository = this.laporanRepository as {
          findLatestLaporanKeuanganSnapshot: () => Promise<LaporanKeuangan | null>;
        };
        laporanRaw = await repository.findLatestLaporanKeuanganSnapshot();
      }

      if (laporanRaw === null) {
        throw new NotFoundException('Laporan keuangan tidak ditemukan');
      }

      if (!this.isLaporanKeuanganRecord(laporanRaw)) {
        throw new BadRequestException('Data laporan keuangan tidak valid');
      }

      const laporan = laporanRaw;

      return this.mapLaporanKeuanganSnapshot(laporan);
    });
  }

  async finalizeLaporanKeuangan(id: number) {
    const laporan = await this.laporanRepository.findLaporanKeuanganById(id);
    if (!laporan) {
      throw new BadRequestException('Laporan keuangan tidak ditemukan');
    }

    if (laporan.statusLaporan === StatusLaporan.FINAL) {
      throw new BadRequestException('Laporan keuangan sudah FINAL');
    }

    const updated = await this.laporanRepository.updateLaporanStatus(
      id,
      StatusLaporan.FINAL,
    );

    await this.invalidateKeuanganSnapshotCache(
      laporan.periodeBulan,
      laporan.periodeTahun,
    );
    await this.dashboardService.invalidateDashboardBecauseFinancialChanged(
      'laporan:finalize',
    );

    return {
      message: 'Laporan keuangan berhasil difinalisasi',
      data: updated,
    };
  }
}
