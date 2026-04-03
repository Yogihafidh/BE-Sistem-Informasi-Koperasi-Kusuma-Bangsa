import { Injectable } from '@nestjs/common';
import { JenisSimpanan, JenisTransaksi } from '@prisma/client';
import { RekapitulasiRepository } from './rekapitulasi.repository';

export type RekapitulasiBulanan = {
  periode: {
    bulan: number;
    tahun: number;
    range: string;
  };
  ringkasan: {
    saldoAwal: number;
    totalPemasukan: number;
    totalPengeluaran: number;
    surplus: number;
    saldoAkhir: number;
  };
  transaksi: {
    totalTransaksi: number;
    totalNominalTransaksi: number;
    avgTransaksiPerHari: number;
    rataRataNominalHarian: number;
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
    totalSimpanan: number;
    simpanan: {
      pokok: number;
      wajib: number;
      sukarela: number;
    };
    pinjaman: {
      totalPinjaman: number;
      jumlahPinjamanAktif: number;
      rataRataPinjaman: number;
    };
  };
  anggota: {
    totalAnggota: number;
    anggotaAktif: number;
    anggotaBaru: number;
    anggotaKeluar: number;
  };
  rasio: {
    rasioArusKas: number;
    pinjamanTerhadapSimpanan: number;
    rasioKeaktifan: number;
  };
  performance: {
    simpanan: {
      growth: number;
      keterangan: string;
    };
    pinjaman: {
      growth: number;
      keterangan: string;
    };
    transaksi: {
      growth: number;
      keterangan: string;
    };
    anggota: {
      persentaseAnggotaBaru: number;
      persentaseAnggotaKeluar: number;
      pertumbuhanBersihAnggota: number;
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

  private growthMetric(current: number, previous: number): number {
    return this.safeDivide(current - previous, previous);
  }

  private growthKeterangan(growth: number): string {
    if (growth > 0) {
      return 'meningkat';
    }

    if (growth < 0) {
      return 'menurun';
    }

    return 'stagnan';
  }

  private formatDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
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
      saldoSimpananByJenis,
      pinjamanOutstandingAgg,
      distinctNasabahPinjamanAktifRows,
      nasabahTotal,
      nasabahAktif,
      nasabahBaru,
      nasabahKeluar,
      previousSaldoSimpananByJenis,
      previousPinjamanOutstandingAgg,
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
      this.repository.groupSaldoSimpananByJenisAt(currentTo),
      this.repository.getOutstandingPinjamanSummaryAt(currentTo),
      this.repository.countDistinctNasabahPinjamanAktifAt(currentTo),
      this.repository.countNasabahTotalAt(currentTo),
      this.repository.countNasabahAktifAt(currentTo),
      this.repository.countNasabahBaru({
        tanggalFrom: currentFrom,
        tanggalTo: currentTo,
      }),
      this.repository.countNasabahKeluar({
        tanggalFrom: currentFrom,
        tanggalTo: currentTo,
      }),
      this.repository.groupSaldoSimpananByJenisAt(previousTo),
      this.repository.getOutstandingPinjamanSummaryAt(previousTo),
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
    const avgTransaksiPerHari = this.safeDivide(
      totalTransaksi,
      jumlahHariDalamBulan,
    );
    const rataRataNominalHarian = this.safeDivide(
      totalNominalTransaksi,
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

    const anggotaAktif = nasabahAktif;
    const totalAnggota = nasabahTotal;
    const rasioKeaktifan = this.safeDivide(anggotaAktif, totalAnggota);

    const previousSimpananPokok = this.toNumber(
      previousSaldoSimpananByJenis.find(
        (item) => item.jenisSimpanan === JenisSimpanan.POKOK,
      )?._sum.saldoBerjalan,
    );
    const previousSimpananWajib = this.toNumber(
      previousSaldoSimpananByJenis.find(
        (item) => item.jenisSimpanan === JenisSimpanan.WAJIB,
      )?._sum.saldoBerjalan,
    );
    const previousSimpananSukarela = this.toNumber(
      previousSaldoSimpananByJenis.find(
        (item) => item.jenisSimpanan === JenisSimpanan.SUKARELA,
      )?._sum.saldoBerjalan,
    );
    const previousTotalSimpanan =
      previousSimpananPokok + previousSimpananWajib + previousSimpananSukarela;
    const previousOutstanding = this.toNumber(
      previousPinjamanOutstandingAgg._sum.sisaPinjaman,
    );
    const previousTotalTransaksi =
      previousByJenis[JenisTransaksi.SETORAN].count +
      previousByJenis[JenisTransaksi.ANGSURAN].count +
      previousByJenis[JenisTransaksi.PENARIKAN].count +
      previousByJenis[JenisTransaksi.PENCAIRAN].count;

    const growthSimpanan = this.growthMetric(
      totalSimpanan,
      previousTotalSimpanan,
    );
    const growthPinjaman = this.growthMetric(
      totalOutstanding,
      previousOutstanding,
    );
    const growthTransaksi = this.growthMetric(
      totalTransaksi,
      previousTotalTransaksi,
    );

    const persentaseAnggotaBaru = this.safeDivide(nasabahBaru, totalAnggota);
    const persentaseAnggotaKeluar = this.safeDivide(
      nasabahKeluar,
      totalAnggota,
    );
    const pertumbuhanBersihAnggota =
      persentaseAnggotaBaru - persentaseAnggotaKeluar;

    return {
      periode: {
        bulan,
        tahun,
        range: `${this.formatDateOnly(currentFrom)} - ${this.formatDateOnly(currentTo)}`,
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
        avgTransaksiPerHari,
        rataRataNominalHarian,
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
        totalSimpanan,
        simpanan: {
          pokok: simpananPokok,
          wajib: simpananWajib,
          sukarela: simpananSukarela,
        },
        pinjaman: {
          totalPinjaman: totalOutstanding,
          jumlahPinjamanAktif: jumlahAktifPinjaman,
          rataRataPinjaman,
        },
      },
      anggota: {
        totalAnggota,
        anggotaAktif,
        anggotaBaru: nasabahBaru,
        anggotaKeluar: nasabahKeluar,
      },
      rasio: {
        rasioArusKas: this.safeDivide(totalPemasukan, totalPengeluaran),
        pinjamanTerhadapSimpanan: this.safeDivide(
          totalOutstanding,
          totalSimpanan,
        ),
        rasioKeaktifan,
      },
      performance: {
        simpanan: {
          growth: growthSimpanan,
          keterangan: this.growthKeterangan(growthSimpanan),
        },
        pinjaman: {
          growth: growthPinjaman,
          keterangan: this.growthKeterangan(growthPinjaman),
        },
        transaksi: {
          growth: growthTransaksi,
          keterangan: this.growthKeterangan(growthTransaksi),
        },
        anggota: {
          persentaseAnggotaBaru,
          persentaseAnggotaKeluar,
          pertumbuhanBersihAnggota,
          keterangan: this.growthKeterangan(pertumbuhanBersihAnggota),
        },
      },
    };
  }
}
 