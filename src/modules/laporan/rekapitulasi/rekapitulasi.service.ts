import { Injectable, NotFoundException } from '@nestjs/common';
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

export type RekapitulasiNasabahBulanan = {
  nasabah: {
    id: string;
    nama: string;
    status: 'AKTIF' | 'NONAKTIF';
    tanggalDaftar: string;
  };
  periode: {
    bulan: number;
    tahun: number;
    range: string;
    jumlahHari: number;
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
    hariAktif: number;
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
  simpanan: {
    totalSimpanan: number;
    detail: {
      pokok: number;
      wajib: number;
      sukarela: number;
    };
  };
  pinjaman: {
    totalPinjaman: number;
    sisaPinjaman: number;
    jumlahPinjamanAktif: number;
    angsuranBulanIni: number;
    statusPinjaman: 'AMAN' | 'BERISIKO';
  };
  aktivitas: {
    frekuensiTransaksi: number;
    hariAktif: number;
    rataRataTransaksiPerHariAktif: number;
    statusAktivitas: 'AKTIF' | 'KURANG_AKTIF' | 'TIDAK_AKTIF';
  };
  rasio: {
    rasioMenabung: number;
    rasioPinjamanTerhadapSimpanan: number;
    rasioArusKasPribadi: number;
  };
  performance: {
    transaksi: {
      growth: number;
      keterangan: string;
    };
    simpanan: {
      growth: number;
      keterangan: string;
    };
    pinjaman: {
      growth: number;
      keterangan: string;
    };
  };
  insight: {
    kategoriNasabah: string;
    catatan: string[];
  };
};

@Injectable()
export class RekapitulasiService {
  constructor(private readonly repository: RekapitulasiRepository) {}

  // Konversi berbagai tipe data (bigint, string, dll) jadi number
  private toNumber(value: unknown): number {
    if (value == null) {
      return 0;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      return Number(value);
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    if (typeof value === 'object' && value !== null && 'toString' in value) {
      return Number((value as { toString: () => string }).toString());
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  // Pembagian aman (hindari division by zero)
  private safeDivide(numerator: number, denominator: number): number {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
      return 0;
    }

    if (denominator === 0) {
      return 0;
    }

    const result = numerator / denominator;
    return Number.isFinite(result) ? result : 0;
  }

  // Hitung growth (pertumbuhan)
  private growthMetric(current: number, previous: number): number {
    return this.safeDivide(current - previous, previous);
  }

  // Keterangan growth
  private growthKeterangan(growth: number): string {
    if (growth > 0) {
      return 'meningkat';
    }

    if (growth < 0) {
      return 'menurun';
    }

    return 'stagnan';
  }

  private growthKeteranganSimple(growth: number): string {
    if (growth > 0) {
      return 'naik';
    }

    if (growth < 0) {
      return 'turun';
    }

    return 'stagnan';
  }

  private sanitizeNumber(value: number): number {
    return Number.isFinite(value) ? value : 0;
  }

  // Format tanggal jadi YYYY-MM-DD
  private formatDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  // Ambil range 1 bulan (awal - akhir)
  private getPeriodRange(bulan: number, tahun: number) {
    const from = new Date(Date.UTC(tahun, bulan - 1, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(tahun, bulan, 0, 23, 59, 59, 999));
    return { from, to };
  }

  // Ambil bulan sebelumnya
  private getPreviousPeriod(bulan: number, tahun: number) {
    if (bulan === 1) {
      return { bulan: 12, tahun: tahun - 1 };
    }

    return { bulan: bulan - 1, tahun };
  }

  // Normalisasi hasil query transaksi agar konsisten per jenis
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

    // Mapping hasil query ke format standar
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
    // 1. TENTUKAN PERIODE
    const now = new Date();

    // Jika tidak ada input pakai bulan & tahun sekarang
    const bulan = rawBulan ?? now.getUTCMonth() + 1;
    const tahun = rawTahun ?? now.getUTCFullYear();

    // Ambil range tanggal bulan ini (awal - akhir bulan)
    const { from: currentFrom, to: currentTo } = this.getPeriodRange(
      bulan,
      tahun,
    );

    // Ambil bulan sebelumnya (untuk perbandingan growth)
    const previousPeriod = this.getPreviousPeriod(bulan, tahun);

    // Ambil range bulan sebelumnya
    const { from: previousFrom, to: previousTo } = this.getPeriodRange(
      previousPeriod.bulan,
      previousPeriod.tahun,
    );

    // 2. Ambil semua data dari database secara paralel
    const [
      currentGrouped, // transaksi bulan ini (group by jenis) - PERIODIK
      previousGrouped, // transaksi bulan lalu - PREVIOUS
      cumulativeUntilPrevious, // transaksi sebelum bulan ini (untuk saldo awal) - KUMULATIF
      saldoSimpananByJenis, // saldo simpanan per jenis - KUMULATIF
      pinjamanOutstandingAgg, // total sisa pinjaman - KUMULATIF
      distinctNasabahPinjamanAktifRows, // jumlah nasabah pinjaman aktif - KUMULATIF
      nasabahTotal, // total anggota - KUMULATIF
      nasabahAktif, // anggota aktif - KUMULATIF
      nasabahBaru, // anggota baru bulan ini - PERIODIK
      nasabahKeluar, // anggota keluar bulan ini - PERIODIK
      previousSaldoSimpananByJenis, // simpanan bulan lalu - PREVIOUS
      previousPinjamanOutstandingAgg, // pinjaman bulan lalu - PREVIOUS
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

    // 3. Normalisasi data transaksi
    const currentByJenis = this.normalizeJenisSummary(currentGrouped);
    const previousByJenis = this.normalizeJenisSummary(previousGrouped);
    const cumulativeByJenis = this.normalizeJenisSummary(
      cumulativeUntilPrevious,
    );

    // 4. HITUNG KEUANGAN
    const setoran = currentByJenis[JenisTransaksi.SETORAN].nominal;
    const angsuran = currentByJenis[JenisTransaksi.ANGSURAN].nominal;
    const penarikan = currentByJenis[JenisTransaksi.PENARIKAN].nominal;
    const pencairan = currentByJenis[JenisTransaksi.PENCAIRAN].nominal;

    // Total uang masuk
    const totalPemasukan = setoran + angsuran;

    // Total uang keluar
    const totalPengeluaran = penarikan + pencairan;

    // Selisih (profit/loss)
    const surplus = totalPemasukan - totalPengeluaran;

    // Saldo awal = semua transaksi sebelum bulan ini
    const saldoAwal =
      cumulativeByJenis[JenisTransaksi.SETORAN].nominal +
      cumulativeByJenis[JenisTransaksi.ANGSURAN].nominal -
      (cumulativeByJenis[JenisTransaksi.PENARIKAN].nominal +
        cumulativeByJenis[JenisTransaksi.PENCAIRAN].nominal);

    // Saldo akhir bulan
    const saldoAkhir = saldoAwal + surplus;

    // 5. HITUNG TRANSAKSI
    const totalTransaksi =
      currentByJenis[JenisTransaksi.SETORAN].count +
      currentByJenis[JenisTransaksi.ANGSURAN].count +
      currentByJenis[JenisTransaksi.PENARIKAN].count +
      currentByJenis[JenisTransaksi.PENCAIRAN].count;

    // Total nominal transaksi (semua jenis)
    const totalNominalTransaksi = setoran + angsuran + penarikan + pencairan;

    // Jumlah hari dalam bulan
    const jumlahHariDalamBulan = new Date(
      Date.UTC(tahun, bulan, 0),
    ).getUTCDate();

    // Rata-rata transaksi per hari
    const avgTransaksiPerHari = this.safeDivide(
      totalTransaksi,
      jumlahHariDalamBulan,
    );

    // Rata-rata nominal transaksi per hari
    const rataRataNominalHarian = this.safeDivide(
      totalNominalTransaksi,
      jumlahHariDalamBulan,
    );

    // 6. HITUNG SIMPANAN
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

    // 7. HITUNG PINJAMAN
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

    // 8. HITUNG ANGGOTA
    const anggotaAktif = nasabahAktif;
    const totalAnggota = nasabahTotal;
    const rasioKeaktifan = this.safeDivide(anggotaAktif, totalAnggota);

    // 9. HITUNG GROWTH
    // Mengambil data bulan sebelumnya untuk dibandingkan (growth)
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

    // Hitung growth
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

    // Persentase anggota
    const persentaseAnggotaBaru = this.safeDivide(nasabahBaru, totalAnggota);
    const persentaseAnggotaKeluar = this.safeDivide(
      nasabahKeluar,
      totalAnggota,
    );
    const pertumbuhanBersihAnggota =
      persentaseAnggotaBaru - persentaseAnggotaKeluar;

    // 10. RETURN HASIL
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

  async getRekapitulasiNasabah(
    nasabahId: number,
    rawBulan?: number,
    rawTahun?: number,
  ): Promise<RekapitulasiNasabahBulanan> {
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
      nasabah,
      currentGrouped,
      previousGrouped,
      cumulativeUntilPrevious,
      hariAktifRows,
      saldoSimpananByJenis,
      previousSaldoSimpananByJenis,
      pinjamanCurrentRows,
      pinjamanPreviousRows,
    ] = await Promise.all([
      this.repository.findNasabahById(nasabahId),
      this.repository.groupTransaksiByJenisNasabah({
        nasabahId,
        tanggalFrom: currentFrom,
        tanggalTo: currentTo,
      }),
      this.repository.groupTransaksiByJenisNasabah({
        nasabahId,
        tanggalFrom: previousFrom,
        tanggalTo: previousTo,
      }),
      this.repository.groupTransaksiByJenisNasabahUntil({
        nasabahId,
        tanggalLte: previousTo,
      }),
      this.repository.countDistinctHariAktifTransaksiNasabah({
        nasabahId,
        tanggalFrom: currentFrom,
        tanggalTo: currentTo,
      }),
      this.repository.groupSaldoSimpananNasabahByJenisAt({
        nasabahId,
        tanggalLte: currentTo,
      }),
      this.repository.groupSaldoSimpananNasabahByJenisAt({
        nasabahId,
        tanggalLte: previousTo,
      }),
      this.repository.getPinjamanNasabahSummaryAt({
        nasabahId,
        tanggalLte: currentTo,
      }),
      this.repository.getPinjamanNasabahSummaryAt({
        nasabahId,
        tanggalLte: previousTo,
      }),
    ]);

    if (!nasabah) {
      throw new NotFoundException('Nasabah tidak ditemukan');
    }

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
    const jumlahHari = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
    const avgTransaksiPerHari = this.safeDivide(totalTransaksi, jumlahHari);
    const rataRataNominalHarian = this.safeDivide(
      totalNominalTransaksi,
      jumlahHari,
    );
    const hariAktif = this.toNumber(hariAktifRows[0]?.count ?? 0);

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

    const pinjamanCurrent = pinjamanCurrentRows[0];
    const totalPinjaman = this.toNumber(pinjamanCurrent?.totalPinjaman ?? 0);
    const sisaPinjaman = this.toNumber(pinjamanCurrent?.sisaPinjaman ?? 0);
    const jumlahPinjamanAktif = this.toNumber(
      pinjamanCurrent?.jumlahPinjamanAktif ?? 0,
    );
    const angsuranBulanIni = angsuran;

    const rasioMenabung = this.safeDivide(totalSimpanan, totalPemasukan);
    const rasioPinjamanTerhadapSimpanan = this.safeDivide(
      totalPinjaman,
      totalSimpanan,
    );
    const rasioArusKasPribadi = this.safeDivide(
      totalPemasukan,
      totalPengeluaran,
    );

    const statusPinjaman: 'AMAN' | 'BERISIKO' =
      rasioPinjamanTerhadapSimpanan > 1 ? 'BERISIKO' : 'AMAN';

    let statusAktivitas: 'AKTIF' | 'KURANG_AKTIF' | 'TIDAK_AKTIF';
    if (totalTransaksi === 0) {
      statusAktivitas = 'TIDAK_AKTIF';
    } else if (totalTransaksi < 5) {
      statusAktivitas = 'KURANG_AKTIF';
    } else {
      statusAktivitas = 'AKTIF';
    }

    const rataRataTransaksiPerHariAktif = this.safeDivide(
      totalTransaksi,
      hariAktif,
    );

    const previousTotalTransaksi =
      previousByJenis[JenisTransaksi.SETORAN].count +
      previousByJenis[JenisTransaksi.ANGSURAN].count +
      previousByJenis[JenisTransaksi.PENARIKAN].count +
      previousByJenis[JenisTransaksi.PENCAIRAN].count;

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

    const pinjamanPrevious = pinjamanPreviousRows[0];
    const previousTotalPinjaman = this.toNumber(
      pinjamanPrevious?.totalPinjaman ?? 0,
    );

    const growthTransaksi = this.growthMetric(
      totalTransaksi,
      previousTotalTransaksi,
    );
    const growthSimpanan = this.growthMetric(
      totalSimpanan,
      previousTotalSimpanan,
    );
    const growthPinjaman = this.growthMetric(
      totalPinjaman,
      previousTotalPinjaman,
    );

    let kategoriNasabah = 'PASIF';
    if (
      statusAktivitas === 'AKTIF' &&
      rasioMenabung > 0.5 &&
      rasioPinjamanTerhadapSimpanan <= 1
    ) {
      kategoriNasabah = 'AKTIF_PRODUKTIF';
    } else if (
      statusAktivitas === 'AKTIF' &&
      rasioPinjamanTerhadapSimpanan > 1
    ) {
      kategoriNasabah = 'AKTIF_BERISIKO';
    }

    const catatan: string[] = [];
    if (statusAktivitas === 'AKTIF') {
      catatan.push('Nasabah aktif melakukan transaksi');
    }
    if (rasioMenabung > 0.5) {
      catatan.push('Memiliki rasio menabung yang baik');
    }
    if (rasioPinjamanTerhadapSimpanan <= 1) {
      catatan.push('Pinjaman dalam kondisi aman');
    }
    if (rasioPinjamanTerhadapSimpanan > 1) {
      catatan.push('Pinjaman berisiko tinggi');
    }

    return {
      nasabah: {
        id: String(nasabah.id),
        nama: nasabah.nama,
        status: nasabah.status === 'AKTIF' ? 'AKTIF' : 'NONAKTIF',
        tanggalDaftar: this.formatDateOnly(nasabah.tanggalDaftar),
      },
      periode: {
        bulan,
        tahun,
        range: `${this.formatDateOnly(currentFrom)} - ${this.formatDateOnly(currentTo)}`,
        jumlahHari,
      },
      ringkasan: {
        saldoAwal: this.sanitizeNumber(saldoAwal),
        totalPemasukan: this.sanitizeNumber(totalPemasukan),
        totalPengeluaran: this.sanitizeNumber(totalPengeluaran),
        surplus: this.sanitizeNumber(surplus),
        saldoAkhir: this.sanitizeNumber(saldoAkhir),
      },
      transaksi: {
        totalTransaksi: this.sanitizeNumber(totalTransaksi),
        totalNominalTransaksi: this.sanitizeNumber(totalNominalTransaksi),
        avgTransaksiPerHari: this.sanitizeNumber(avgTransaksiPerHari),
        rataRataNominalHarian: this.sanitizeNumber(rataRataNominalHarian),
        hariAktif: this.sanitizeNumber(hariAktif),
        breakdown: {
          pemasukan: {
            setoran: this.sanitizeNumber(setoran),
            angsuran: this.sanitizeNumber(angsuran),
          },
          pengeluaran: {
            penarikan: this.sanitizeNumber(penarikan),
            pencairan: this.sanitizeNumber(pencairan),
          },
        },
      },
      simpanan: {
        totalSimpanan: this.sanitizeNumber(totalSimpanan),
        detail: {
          pokok: this.sanitizeNumber(simpananPokok),
          wajib: this.sanitizeNumber(simpananWajib),
          sukarela: this.sanitizeNumber(simpananSukarela),
        },
      },
      pinjaman: {
        totalPinjaman: this.sanitizeNumber(totalPinjaman),
        sisaPinjaman: this.sanitizeNumber(sisaPinjaman),
        jumlahPinjamanAktif: this.sanitizeNumber(jumlahPinjamanAktif),
        angsuranBulanIni: this.sanitizeNumber(angsuranBulanIni),
        statusPinjaman,
      },
      aktivitas: {
        frekuensiTransaksi: this.sanitizeNumber(totalTransaksi),
        hariAktif: this.sanitizeNumber(hariAktif),
        rataRataTransaksiPerHariAktif: this.sanitizeNumber(
          rataRataTransaksiPerHariAktif,
        ),
        statusAktivitas,
      },
      rasio: {
        rasioMenabung: this.sanitizeNumber(rasioMenabung),
        rasioPinjamanTerhadapSimpanan: this.sanitizeNumber(
          rasioPinjamanTerhadapSimpanan,
        ),
        rasioArusKasPribadi: this.sanitizeNumber(rasioArusKasPribadi),
      },
      performance: {
        transaksi: {
          growth: this.sanitizeNumber(growthTransaksi),
          keterangan: this.growthKeteranganSimple(growthTransaksi),
        },
        simpanan: {
          growth: this.sanitizeNumber(growthSimpanan),
          keterangan: this.growthKeteranganSimple(growthSimpanan),
        },
        pinjaman: {
          growth: this.sanitizeNumber(growthPinjaman),
          keterangan: this.growthKeteranganSimple(growthPinjaman),
        },
      },
      insight: {
        kategoriNasabah,
        catatan,
      },
    };
  }
}
