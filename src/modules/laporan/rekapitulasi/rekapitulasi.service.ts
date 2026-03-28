import { Injectable } from '@nestjs/common';
import { JenisSimpanan, JenisTransaksi } from '@prisma/client';
import { RekapitulasiRepository } from './rekapitulasi.repository';

export type RekapitulasiBulanan = {
  periode: {
    bulan: number;
    tahun: number;
  };
  ringkasan: {
    saldoAwal: number;
    saldoAkhir: number;
    totalPemasukan: number;
    totalPengeluaran: number;
    surplus: number;
  };
  transaksi: {
    totalTransaksi: number;
    totalNominalTransaksi: number;
    rataRataHarian: number;
    breakdown: {
      pemasukan: {
        setoran: number;
        angsuran: number;
      };
      pengeluaran: {
        penarikan: number;
        pencairan: number;
      };
    };
  };
  keuangan: {
    simpanan: {
      total: number;
      pokok: number;
      wajib: number;
      sukarela: number;
    };
    pinjaman: {
      totalOutstanding: number;
      jumlahAktif: number;
      rataRata: number;
    };
  };
  anggota: {
    total: number;
    aktif: number;
    anggotaBaru: number;
    anggotaKeluar: number;
    rasioKeaktifan: number;
  };
  rasio: {
    likuiditas: number;
    pinjamanTerhadapSimpanan: number;
    keaktifanAnggota: number;
  };
  performance: {
    simpanan: {
      growth: number | null;
      keterangan: string;
    };
    pinjaman: {
      growth: number | null;
      keterangan: string;
    };
    transaksi: {
      growth: number | null;
      keterangan: string;
    };
    anggota: {
      growth: number | null;
      keterangan: string;
    };
  };
};

@Injectable()
export class RekapitulasiService {
  constructor(private readonly repository: RekapitulasiRepository) {}

  private toNumber(value: unknown): number {
    if (value == null) {
      return 0;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    if (typeof value === 'object' && value !== null && 'toString' in value) {
      return Number((value as { toString: () => string }).toString());
    }

    return 0;
  }

  private safeDivide(numerator: number, denominator: number): number {
    if (denominator === 0) {
      return 0;
    }

    return numerator / denominator;
  }

  private growthMetric(current: number, previous: number) {
    if (previous === 0) {
      return {
        growth: null,
        keterangan: 'tidak dapat dihitung',
      };
    }

    const growth = (current - previous) / previous;

    if (growth > 0) {
      return { growth, keterangan: 'meningkat' };
    }

    if (growth < 0) {
      return { growth, keterangan: 'menurun' };
    }

    return { growth, keterangan: 'stabil' };
  }

  private getPeriodRange(bulan: number, tahun: number) {
    const from = new Date(Date.UTC(tahun, bulan - 1, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(tahun, bulan, 0, 23, 59, 59, 999));
    return { from, to };
  }

  private getPreviousPeriod(bulan: number, tahun: number) {
    if (bulan === 1) {
      return { bulan: 12, tahun: tahun - 1 };
    }

    return { bulan: bulan - 1, tahun };
  }

  private normalizeJenisSummary(
    rows: Array<{
      jenisTransaksi: JenisTransaksi;
      _sum: { nominal: unknown };
      _count?: { _all: number };
    }>,
  ) {
    const result: Record<JenisTransaksi, { nominal: number; count: number }> = {
      [JenisTransaksi.SETORAN]: { nominal: 0, count: 0 },
      [JenisTransaksi.PENARIKAN]: { nominal: 0, count: 0 },
      [JenisTransaksi.PENCAIRAN]: { nominal: 0, count: 0 },
      [JenisTransaksi.ANGSURAN]: { nominal: 0, count: 0 },
    };

    for (const row of rows) {
      result[row.jenisTransaksi] = {
        nominal: this.toNumber(row._sum.nominal),
        count: row._count?._all ?? 0,
      };
    }

    return result;
  }

  async getRekapitulasiBulanan(
    rawBulan?: number,
    rawTahun?: number,
  ): Promise<RekapitulasiBulanan> {
    const now = new Date();
    const bulan = rawBulan ?? now.getUTCMonth() + 1;
    const tahun = rawTahun ?? now.getUTCFullYear();

    const { from: currentFrom, to: currentTo } = this.getPeriodRange(
      bulan,
      tahun,
    );
    const previousPeriod = this.getPreviousPeriod(bulan, tahun);
    const { from: previousFrom, to: previousTo } = this.getPeriodRange(
      previousPeriod.bulan,
      previousPeriod.tahun,
    );

    const [
      currentGrouped,
      previousGrouped,
      cumulativeUntilPrevious,
      distinctNasabahTransaksiCurrentRows,
      saldoSimpananByJenis,
      pinjamanOutstandingAgg,
      distinctNasabahPinjamanAktifRows,
      nasabahTotal,
      nasabahBaru,
      nasabahKeluar,
    ] = await Promise.all([
      this.repository.groupTransaksiByJenis({
        tanggalFrom: currentFrom,
        tanggalTo: currentTo,
      }),
      this.repository.groupTransaksiByJenis({
        tanggalFrom: previousFrom,
        tanggalTo: previousTo,
      }),
      this.repository.groupTransaksiByJenisUntil(previousTo),
      this.repository.countDistinctNasabahTransaksi({
        tanggalFrom: currentFrom,
        tanggalTo: currentTo,
      }),
      this.repository.groupSaldoSimpananByJenis(),
      this.repository.getOutstandingPinjamanSummary(),
      this.repository.countDistinctNasabahPinjamanAktif(),
      this.repository.countNasabahTotal(),
      this.repository.countNasabahBaru({
        tanggalFrom: currentFrom,
        tanggalTo: currentTo,
      }),
      this.repository.countNasabahKeluar({
        tanggalFrom: currentFrom,
        tanggalTo: currentTo,
      }),
    ]);

    const currentByJenis = this.normalizeJenisSummary(currentGrouped);
    const previousByJenis = this.normalizeJenisSummary(previousGrouped);
    const cumulativeByJenis = this.normalizeJenisSummary(
      cumulativeUntilPrevious,
    );

    const setoran = currentByJenis[JenisTransaksi.SETORAN].nominal;
    const angsuran = currentByJenis[JenisTransaksi.ANGSURAN].nominal;
    const penarikan = currentByJenis[JenisTransaksi.PENARIKAN].nominal;
    const pencairan = currentByJenis[JenisTransaksi.PENCAIRAN].nominal;

    const totalPemasukan = setoran + angsuran;
    const totalPengeluaran = penarikan + pencairan;
    const surplus = totalPemasukan - totalPengeluaran;

    const saldoAwal =
      cumulativeByJenis[JenisTransaksi.SETORAN].nominal +
      cumulativeByJenis[JenisTransaksi.ANGSURAN].nominal -
      (cumulativeByJenis[JenisTransaksi.PENARIKAN].nominal +
        cumulativeByJenis[JenisTransaksi.PENCAIRAN].nominal);

    const saldoAkhir = saldoAwal + surplus;

    const totalTransaksi =
      currentByJenis[JenisTransaksi.SETORAN].count +
      currentByJenis[JenisTransaksi.ANGSURAN].count +
      currentByJenis[JenisTransaksi.PENARIKAN].count +
      currentByJenis[JenisTransaksi.PENCAIRAN].count;

    const totalNominalTransaksi = setoran + angsuran + penarikan + pencairan;
    const jumlahHariDalamBulan = new Date(
      Date.UTC(tahun, bulan, 0),
    ).getUTCDate();
    const rataRataHarian = this.safeDivide(
      totalTransaksi,
      jumlahHariDalamBulan,
    );

    const simpananPokok = this.toNumber(
      saldoSimpananByJenis.find(
        (item) => item.jenisSimpanan === JenisSimpanan.POKOK,
      )?._sum.saldoBerjalan,
    );
    const simpananWajib = this.toNumber(
      saldoSimpananByJenis.find(
        (item) => item.jenisSimpanan === JenisSimpanan.WAJIB,
      )?._sum.saldoBerjalan,
    );
    const simpananSukarela = this.toNumber(
      saldoSimpananByJenis.find(
        (item) => item.jenisSimpanan === JenisSimpanan.SUKARELA,
      )?._sum.saldoBerjalan,
    );
    const totalSimpanan = simpananPokok + simpananWajib + simpananSukarela;

    const totalOutstanding = this.toNumber(
      pinjamanOutstandingAgg._sum.sisaPinjaman,
    );
    const jumlahAktifPinjaman = this.toNumber(
      distinctNasabahPinjamanAktifRows[0]?.count ?? 0,
    );
    const rataRataPinjaman = this.safeDivide(
      totalOutstanding,
      jumlahAktifPinjaman,
    );

    const anggotaAktif = this.toNumber(
      distinctNasabahTransaksiCurrentRows[0]?.count ?? 0,
    );
    const rasioKeaktifan = this.safeDivide(anggotaAktif, nasabahTotal);

    const previousTotalSimpanan = totalSimpanan - (setoran - penarikan);
    const previousOutstanding = totalOutstanding - pencairan + angsuran;
    const previousTotalTransaksi =
      previousByJenis[JenisTransaksi.SETORAN].count +
      previousByJenis[JenisTransaksi.ANGSURAN].count +
      previousByJenis[JenisTransaksi.PENARIKAN].count +
      previousByJenis[JenisTransaksi.PENCAIRAN].count;
    const previousTotalAnggota = Math.max(
      0,
      nasabahTotal - nasabahBaru + nasabahKeluar,
    );

    return {
      periode: {
        bulan,
        tahun,
      },
      ringkasan: {
        saldoAwal,
        saldoAkhir,
        totalPemasukan,
        totalPengeluaran,
        surplus,
      },
      transaksi: {
        totalTransaksi,
        totalNominalTransaksi,
        rataRataHarian,
        breakdown: {
          pemasukan: {
            setoran,
            angsuran,
          },
          pengeluaran: {
            penarikan,
            pencairan,
          },
        },
      },
      keuangan: {
        simpanan: {
          total: totalSimpanan,
          pokok: simpananPokok,
          wajib: simpananWajib,
          sukarela: simpananSukarela,
        },
        pinjaman: {
          totalOutstanding,
          jumlahAktif: jumlahAktifPinjaman,
          rataRata: rataRataPinjaman,
        },
      },
      anggota: {
        total: nasabahTotal,
        aktif: anggotaAktif,
        anggotaBaru: nasabahBaru,
        anggotaKeluar: nasabahKeluar,
        rasioKeaktifan,
      },
      rasio: {
        likuiditas: this.safeDivide(saldoAkhir, totalPengeluaran),
        pinjamanTerhadapSimpanan: this.safeDivide(
          totalOutstanding,
          totalSimpanan,
        ),
        keaktifanAnggota: this.safeDivide(anggotaAktif, nasabahTotal),
      },
      performance: {
        simpanan: this.growthMetric(totalSimpanan, previousTotalSimpanan),
        pinjaman: this.growthMetric(totalOutstanding, previousOutstanding),
        transaksi: this.growthMetric(totalTransaksi, previousTotalTransaksi),
        anggota: this.growthMetric(nasabahTotal, previousTotalAnggota),
      },
    };
  }
}
