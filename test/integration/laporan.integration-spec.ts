import { INestApplication } from '@nestjs/common';
import {
  JenisSimpanan,
  JenisTransaksi,
  NasabahStatus,
  PinjamanStatus,
  PrismaClient,
} from '@prisma/client';
import {
  createTestApp,
  cleanupDatabase,
  seedDatabase,
  closeTestApp,
  getPrisma,
} from '../helpers/test-app.helper';
import {
  loginAsAdmin,
  authGet,
  authPost,
  registerAndLogin,
} from '../helpers/auth.helper';

/**
 * Integration test untuk memvalidasi endpoint laporan rekapitulasi bulanan.
 *
 * Tujuan:
 * - Memastikan data ringkasan bulanan dihitung sesuai skenario bisnis
 * - Memastikan akses endpoint laporan mengikuti aturan otorisasi
 * - Mencegah regression pada laporan yang dipakai untuk monitoring operasional
 */
describe('Rekapitulasi Bulanan Endpoint (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken: string;

  const bulan = 3;
  const tahun = 2026;
  const noAccessPassword = ['No', 'Access', '123', '!'].join('');
  let snapshotId: number;

  beforeAll(async () => {
    // Inisialisasi aplikasi NestJS dalam mode testing
    app = await createTestApp();
    prisma = getPrisma();

    // Reset database untuk memastikan kondisi awal selalu bersih dan konsisten
    await cleanupDatabase(prisma);

    // Isi database dengan data awal untuk kebutuhan skenario integration
    await seedDatabase(prisma);

    // Login sebagai admin untuk mendapatkan access token endpoint protected
    adminToken = (await loginAsAdmin(app)).accessToken;

    const adminPegawai = await prisma.pegawai.findFirstOrThrow({
      where: {
        user: {
          username: 'admin',
        },
      },
      select: {
        id: true,
      },
    });

    const n1 = await prisma.nasabah.create({
      data: {
        pegawaiId: adminPegawai.id,
        nomorAnggota: 'TST-RKP-001',
        nama: 'Nasabah Satu',
        nik: '3201010101011001',
        alamat: 'Bandung',
        noHp: '081111000001',
        pekerjaan: 'Wiraswasta',
        instansi: 'Usaha Satu',
        penghasilanBulanan: 5000000,
        tanggalLahir: new Date('1990-01-01T00:00:00.000Z'),
        tanggalDaftar: new Date('2026-01-05T10:00:00.000Z'),
        status: NasabahStatus.AKTIF,
      },
    });

    const n2 = await prisma.nasabah.create({
      data: {
        pegawaiId: adminPegawai.id,
        nomorAnggota: 'TST-RKP-002',
        nama: 'Nasabah Dua',
        nik: '3201010101011002',
        alamat: 'Bandung',
        noHp: '081111000002',
        pekerjaan: 'Karyawan',
        instansi: 'Perusahaan Dua',
        penghasilanBulanan: 4500000,
        tanggalLahir: new Date('1991-02-02T00:00:00.000Z'),
        tanggalDaftar: new Date('2026-02-10T10:00:00.000Z'),
        status: NasabahStatus.AKTIF,
      },
    });

    const n3 = await prisma.nasabah.create({
      data: {
        pegawaiId: adminPegawai.id,
        nomorAnggota: 'TST-RKP-003',
        nama: 'Nasabah Tiga',
        nik: '3201010101011003',
        alamat: 'Bandung',
        noHp: '081111000003',
        pekerjaan: 'Pedagang',
        instansi: 'Usaha Tiga',
        penghasilanBulanan: 4000000,
        tanggalLahir: new Date('1992-03-03T00:00:00.000Z'),
        tanggalDaftar: new Date('2026-03-05T10:00:00.000Z'),
        status: NasabahStatus.NONAKTIF,
      },
    });

    await prisma.$executeRaw`
      UPDATE "Nasabah"
      SET "updatedAt" = ${new Date('2026-03-20T10:00:00.000Z')}
      WHERE id = ${n3.id}
    `;

    await prisma.rekeningSimpanan.createMany({
      data: [
        {
          nasabahId: n1.id,
          jenisSimpanan: JenisSimpanan.POKOK,
          saldoBerjalan: 3000000,
        },
        {
          nasabahId: n1.id,
          jenisSimpanan: JenisSimpanan.WAJIB,
          saldoBerjalan: 2000000,
        },
        {
          nasabahId: n2.id,
          jenisSimpanan: JenisSimpanan.SUKARELA,
          saldoBerjalan: 1000000,
        },
      ],
    });

    await prisma.pinjaman.createMany({
      data: [
        {
          nasabahId: n1.id,
          jumlahPinjaman: 5000000,
          bungaPersen: 2.5,
          tenorBulan: 12,
          totalPengembalian: 6500000,
          angsuranPerBulan: 541666.6666666666,
          sisaPinjaman: 2500000,
          status: PinjamanStatus.DISETUJUI,
          tanggalPersetujuan: new Date('2026-01-10T10:00:00.000Z'),
        },
        {
          nasabahId: n2.id,
          jumlahPinjaman: 3000000,
          bungaPersen: 2.5,
          tenorBulan: 10,
          totalPengembalian: 3750000,
          angsuranPerBulan: 375000,
          sisaPinjaman: 1500000,
          status: PinjamanStatus.DISETUJUI,
          tanggalPersetujuan: new Date('2026-02-12T10:00:00.000Z'),
        },
        {
          nasabahId: n2.id,
          jumlahPinjaman: 2000000,
          bungaPersen: 2.5,
          tenorBulan: 8,
          totalPengembalian: 2400000,
          angsuranPerBulan: 300000,
          sisaPinjaman: 0,
          status: PinjamanStatus.LUNAS,
          tanggalPersetujuan: new Date('2026-01-25T10:00:00.000Z'),
        },
      ],
    });

    await prisma.transaksi.createMany({
      data: [
        // Januari 2026
        {
          nasabahId: n1.id,
          pegawaiId: adminPegawai.id,
          jenisTransaksi: JenisTransaksi.SETORAN,
          nominal: 1000000,
          tanggal: new Date('2026-01-07T10:00:00.000Z'),
          metodePembayaran: 'CASH',
        },
        {
          nasabahId: n1.id,
          pegawaiId: adminPegawai.id,
          jenisTransaksi: JenisTransaksi.ANGSURAN,
          nominal: 300000,
          tanggal: new Date('2026-01-12T10:00:00.000Z'),
          metodePembayaran: 'CASH',
        },
        {
          nasabahId: n1.id,
          pegawaiId: adminPegawai.id,
          jenisTransaksi: JenisTransaksi.PENARIKAN,
          nominal: 200000,
          tanggal: new Date('2026-01-16T10:00:00.000Z'),
          metodePembayaran: 'CASH',
        },
        {
          nasabahId: n2.id,
          pegawaiId: adminPegawai.id,
          jenisTransaksi: JenisTransaksi.PENCAIRAN,
          nominal: 500000,
          tanggal: new Date('2026-01-23T10:00:00.000Z'),
          metodePembayaran: 'TRANSFER',
        },
        // Februari 2026
        {
          nasabahId: n1.id,
          pegawaiId: adminPegawai.id,
          jenisTransaksi: JenisTransaksi.SETORAN,
          nominal: 800000,
          tanggal: new Date('2026-02-03T10:00:00.000Z'),
          metodePembayaran: 'CASH',
        },
        {
          nasabahId: n2.id,
          pegawaiId: adminPegawai.id,
          jenisTransaksi: JenisTransaksi.ANGSURAN,
          nominal: 200000,
          tanggal: new Date('2026-02-08T10:00:00.000Z'),
          metodePembayaran: 'CASH',
        },
        {
          nasabahId: n1.id,
          pegawaiId: adminPegawai.id,
          jenisTransaksi: JenisTransaksi.PENARIKAN,
          nominal: 100000,
          tanggal: new Date('2026-02-11T10:00:00.000Z'),
          metodePembayaran: 'CASH',
        },
        {
          nasabahId: n2.id,
          pegawaiId: adminPegawai.id,
          jenisTransaksi: JenisTransaksi.PENCAIRAN,
          nominal: 400000,
          tanggal: new Date('2026-02-20T10:00:00.000Z'),
          metodePembayaran: 'TRANSFER',
        },
        // Maret 2026
        {
          nasabahId: n1.id,
          pegawaiId: adminPegawai.id,
          jenisTransaksi: JenisTransaksi.SETORAN,
          nominal: 1000000,
          tanggal: new Date('2026-03-05T10:00:00.000Z'),
          metodePembayaran: 'CASH',
        },
        {
          nasabahId: n2.id,
          pegawaiId: adminPegawai.id,
          jenisTransaksi: JenisTransaksi.SETORAN,
          nominal: 500000,
          tanggal: new Date('2026-03-14T10:00:00.000Z'),
          metodePembayaran: 'CASH',
        },
        {
          nasabahId: n1.id,
          pegawaiId: adminPegawai.id,
          jenisTransaksi: JenisTransaksi.ANGSURAN,
          nominal: 500000,
          tanggal: new Date('2026-03-18T10:00:00.000Z'),
          metodePembayaran: 'CASH',
        },
        {
          nasabahId: n1.id,
          pegawaiId: adminPegawai.id,
          jenisTransaksi: JenisTransaksi.PENARIKAN,
          nominal: 400000,
          tanggal: new Date('2026-03-22T10:00:00.000Z'),
          metodePembayaran: 'CASH',
        },
        {
          nasabahId: n2.id,
          pegawaiId: adminPegawai.id,
          jenisTransaksi: JenisTransaksi.PENCAIRAN,
          nominal: 700000,
          tanggal: new Date('2026-03-27T10:00:00.000Z'),
          metodePembayaran: 'TRANSFER',
        },
      ],
    });
  });

  afterAll(async () => {
    // Menutup koneksi aplikasi setelah seluruh test selesai dijalankan
    await closeTestApp(app);
  });

  describe('GET /api/rekapitulasi/bulanan', () => {
    // Rekap bulanan harus mengembalikan ringkasan dan rasio yang konsisten
    it('should return consistent ringkasan, rasio, and performance metrics for March 2026 dataset', async () => {
      const res = await authGet(
        app,
        `/api/rekapitulasi/bulanan?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(200);

      const body = res.body;

      expect(body.periode).toEqual(
        expect.objectContaining({
          bulan: 3,
          tahun: 2026,
          range: '2026-03-01 - 2026-03-31',
        }),
      );

      expect(body.ringkasan).toEqual({
        saldoAwal: 1100000,
        saldoAkhir: 2000000,
        totalPemasukan: 2000000,
        totalPengeluaran: 1100000,
        surplus: 900000,
      });

      expect(body.transaksi.totalTransaksi).toBe(5);
      expect(body.transaksi.totalNominalTransaksi).toBe(3100000);
      expect(body.transaksi.avgTransaksiPerHari).toBeCloseTo(5 / 31, 10);
      expect(body.transaksi.rataRataNominalHarian).toBeCloseTo(
        3100000 / 31,
        10,
      );
      expect(body.transaksi.breakdown).toEqual({
        pemasukan: {
          setoran: 1500000,
          angsuran: 500000,
        },
        pengeluaran: {
          penarikan: 400000,
          pencairan: 700000,
        },
      });

      expect(body.keuangan).toEqual({
        totalSimpanan: 6000000,
        simpanan: {
          pokok: 3000000,
          wajib: 2000000,
          sukarela: 1000000,
        },
        pinjaman: {
          totalPinjaman: 4000000,
          jumlahPinjamanAktif: 2,
          rataRataPinjaman: 2000000,
        },
      });

      expect(body.anggota.totalAnggota).toBe(3);
      expect(body.anggota.anggotaAktif).toBe(2);
      expect(body.anggota.anggotaBaru).toBe(1);
      expect(body.anggota.anggotaKeluar).toBe(1);

      expect(body.rasio.rasioArusKas).toBeCloseTo(2000000 / 1100000, 10);
      expect(body.rasio.pinjamanTerhadapSimpanan).toBeCloseTo(4 / 6, 10);
      expect(body.rasio.rasioKeaktifan).toBeCloseTo(2 / 3, 10);

      expect(body.performance.simpanan.growth).toBeCloseTo(0, 10);
      expect(body.performance.simpanan.keterangan).toBe('stagnan');

      expect(body.performance.pinjaman.growth).toBeCloseTo(0, 10);
      expect(body.performance.pinjaman.keterangan).toBe('stagnan');

      expect(body.performance.transaksi.growth).toBeCloseTo(0.25, 10);
      expect(body.performance.transaksi.keterangan).toBe('meningkat');

      expect(body.performance.anggota.persentaseAnggotaBaru).toBeCloseTo(
        1 / 3,
        10,
      );
      expect(body.performance.anggota.persentaseAnggotaKeluar).toBeCloseTo(
        1 / 3,
        10,
      );
      expect(body.performance.anggota.pertumbuhanBersihAnggota).toBeCloseTo(
        0,
        10,
      );
      expect(body.performance.anggota.keterangan).toBe('stagnan');
    });

    // Perubahan transaksi harus langsung tercermin tanpa menunggu cache
    it('should reflect fresh data immediately without cache', async () => {
      const before = await authGet(
        app,
        `/api/rekapitulasi/bulanan?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(200);

      const adminPegawai = await prisma.pegawai.findFirstOrThrow({
        where: { user: { username: 'admin' } },
        select: { id: true },
      });
      const firstNasabah = await prisma.nasabah.findFirstOrThrow({
        where: { nomorAnggota: 'TST-RKP-001' },
        select: { id: true },
      });

      const inserted = await prisma.transaksi.create({
        data: {
          nasabahId: firstNasabah.id,
          pegawaiId: adminPegawai.id,
          jenisTransaksi: JenisTransaksi.SETORAN,
          nominal: 250000,
          tanggal: new Date('2026-03-29T10:00:00.000Z'),
          metodePembayaran: 'CASH',
        },
      });

      const after = await authGet(
        app,
        `/api/rekapitulasi/bulanan?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(200);

      expect(after.body.ringkasan.totalPemasukan).toBe(
        before.body.ringkasan.totalPemasukan + 250000,
      );
      expect(after.body.transaksi.totalTransaksi).toBe(
        before.body.transaksi.totalTransaksi + 1,
      );

      await prisma.transaksi.delete({
        where: { id: inserted.id },
      });
    });

    // Keputusan verifikasi permission harus tercermin di data
    it('should reject users without laporan.read permission', async () => {
      const user = await registerAndLogin(app, {
        username: 'rekap-noaccess',
        email: 'rekap-noaccess@test.com',
        password: noAccessPassword,
      });

      await authGet(
        app,
        `/api/rekapitulasi/bulanan?bulan=${bulan}&tahun=${tahun}`,
        user.accessToken,
      ).expect(403);
    });
  });

  describe('Snapshot Laporan Keuangan', () => {
    // Pembuatan laporan harus menyimpan data yang valid
    it('should generate laporan keuangan snapshot', async () => {
      const res = await authPost(
        app,
        `/api/laporan/keuangan/generate?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(201);

      expect(res.body.message).toBe('Laporan keuangan berhasil di-generate');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.periodeBulan).toBe(bulan);
      expect(res.body.data.periodeTahun).toBe(tahun);
      expect(res.body.data.statusLaporan).toBe('DRAFT');

      snapshotId = res.body.data.id as number;
      expect(typeof snapshotId).toBe('number');
    });

    // Hasil laporan harus konsisten dengan data sumber
    it('should return snapshot report that is consistent with realtime source at generation period', async () => {
      const realtime = await authGet(
        app,
        `/api/rekapitulasi/bulanan?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(200);

      const snapshot = await authGet(
        app,
        `/api/laporan/keuangan?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(200);

      expect(snapshot.body.periodeBulan).toBe(bulan);
      expect(snapshot.body.periodeTahun).toBe(tahun);

      expect(snapshot.body.totalSimpanan).toBe(
        realtime.body.keuangan.totalSimpanan,
      );
      expect(snapshot.body.totalPenarikan).toBe(
        realtime.body.transaksi.breakdown.pengeluaran.penarikan,
      );
      expect(snapshot.body.totalPinjaman).toBe(
        realtime.body.keuangan.pinjaman.totalPinjaman,
      );
      expect(snapshot.body.totalAngsuran).toBe(
        realtime.body.transaksi.breakdown.pemasukan.angsuran,
      );
      expect(snapshot.body.saldoAkhir).toBe(realtime.body.ringkasan.saldoAkhir);

      expect(snapshot.body.statusLaporan).toBe('DRAFT');
      expect(snapshot.body).toHaveProperty('generatedById');
      expect(snapshot.body).toHaveProperty('generatedAt');
    });

    // Hasil laporan harus konsisten dengan data sumber
    it('should finalize laporan keuangan snapshot', async () => {
      const res = await authPost(
        app,
        `/api/laporan/keuangan/${snapshotId}/finalize`,
        adminToken,
      ).expect(201);

      expect(res.body.message).toBe('Laporan keuangan berhasil difinalisasi');
      expect(res.body.data.statusLaporan).toBe('FINAL');

      const snapshot = await authGet(
        app,
        `/api/laporan/keuangan?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(200);

      expect(snapshot.body.statusLaporan).toBe('FINAL');
    });

    // Proses verifikasi laporan harus mengubah status dengan benar
    it('should reject regenerate on finalized laporan keuangan period', async () => {
      await authPost(
        app,
        `/api/laporan/keuangan/generate?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(400);
    });

    // Snapshot laporan harus stabil untuk periode yang sama
    it('should return latest snapshot when periode is omitted', async () => {
      const res = await authGet(
        app,
        '/api/laporan/keuangan',
        adminToken,
      ).expect(200);

      expect(res.body.id).toBe(snapshotId);
      expect(res.body.periodeBulan).toBe(bulan);
      expect(res.body.periodeTahun).toBe(tahun);
      expect(res.body.statusLaporan).toBe('FINAL');
    });

    // Keputusan verifikasi permission harus tercermin di data
    it('should reject users without laporan.generate permission', async () => {
      const user = await registerAndLogin(app, {
        username: 'snapshot-noaccess',
        email: 'snapshot-noaccess@test.com',
        password: noAccessPassword,
      });

      await authPost(
        app,
        `/api/laporan/keuangan/generate?bulan=${bulan}&tahun=${tahun}`,
        user.accessToken,
      ).expect(403);
    });
  });

  describe('GET /api/rekapitulasi/nasabah/:nasabahId', () => {
    it('should return detailed rekapitulasi for a specific nasabah on March 2026', async () => {
      const nasabah = await prisma.nasabah.findFirstOrThrow({
        where: { nomorAnggota: 'TST-RKP-001' },
        select: { id: true },
      });

      const res = await authGet(
        app,
        `/api/rekapitulasi/nasabah/${nasabah.id}?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(200);

      const body = res.body;

      expect(body.nasabah).toEqual(
        expect.objectContaining({
          id: String(nasabah.id),
          nama: 'Nasabah Satu',
          status: 'AKTIF',
          tanggalDaftar: '2026-01-05',
        }),
      );

      expect(body.periode).toEqual({
        bulan: 3,
        tahun: 2026,
        range: '2026-03-01 - 2026-03-31',
        jumlahHari: 31,
      });

      expect(body.ringkasan).toEqual({
        saldoAwal: 1800000,
        totalPemasukan: 1500000,
        totalPengeluaran: 400000,
        surplus: 1100000,
        saldoAkhir: 2900000,
      });

      expect(body.transaksi).toEqual({
        totalTransaksi: 3,
        totalNominalTransaksi: 1900000,
        avgTransaksiPerHari: 3 / 31,
        rataRataNominalHarian: 1900000 / 31,
        hariAktif: 3,
        breakdown: {
          pemasukan: {
            setoran: 1000000,
            angsuran: 500000,
          },
          pengeluaran: {
            penarikan: 400000,
            pencairan: 0,
          },
        },
      });

      expect(body.simpanan).toEqual({
        totalSimpanan: 5000000,
        detail: {
          pokok: 3000000,
          wajib: 2000000,
          sukarela: 0,
        },
      });

      expect(body.pinjaman).toEqual({
        totalPinjaman: 5000000,
        sisaPinjaman: 2500000,
        jumlahPinjamanAktif: 1,
        angsuranBulanIni: 500000,
        statusPinjaman: 'AMAN',
      });

      expect(body.aktivitas).toEqual({
        frekuensiTransaksi: 3,
        hariAktif: 3,
        rataRataTransaksiPerHariAktif: 1,
        statusAktivitas: 'KURANG_AKTIF',
      });

      expect(body.rasio.rasioMenabung).toBeCloseTo(5000000 / 1500000, 10);
      expect(body.rasio.rasioPinjamanTerhadapSimpanan).toBeCloseTo(1, 10);
      expect(body.rasio.rasioArusKasPribadi).toBeCloseTo(1500000 / 400000, 10);

      expect(body.performance.transaksi.growth).toBeCloseTo(0.5, 10);
      expect(body.performance.transaksi.keterangan).toBe('naik');
      expect(body.performance.simpanan.growth).toBeCloseTo(0, 10);
      expect(body.performance.simpanan.keterangan).toBe('stagnan');
      expect(body.performance.pinjaman.growth).toBeCloseTo(0, 10);
      expect(body.performance.pinjaman.keterangan).toBe('stagnan');

      expect(body.insight.kategoriNasabah).toBe('PASIF');
      expect(body.insight.catatan).toContain(
        'Memiliki rasio menabung yang baik',
      );
      expect(body.insight.catatan).toContain('Pinjaman dalam kondisi aman');
      expect(body.insight.catatan).not.toContain(
        'Nasabah aktif melakukan transaksi',
      );
    });

    it('should handle zero-denominator cases safely without NaN', async () => {
      const adminPegawai = await prisma.pegawai.findFirstOrThrow({
        where: { user: { username: 'admin' } },
        select: { id: true },
      });

      const noTxNasabah = await prisma.nasabah.create({
        data: {
          pegawaiId: adminPegawai.id,
          nomorAnggota: 'TST-RKP-099',
          nama: 'Nasabah Tanpa Transaksi',
          nik: '3201010101011099',
          alamat: 'Bandung',
          noHp: '081111000099',
          pekerjaan: 'Freelancer',
          instansi: 'Mandiri',
          penghasilanBulanan: 3000000,
          tanggalLahir: new Date('1995-09-09T00:00:00.000Z'),
          tanggalDaftar: new Date('2026-03-25T10:00:00.000Z'),
          status: NasabahStatus.AKTIF,
        },
      });

      const res = await authGet(
        app,
        `/api/rekapitulasi/nasabah/${noTxNasabah.id}?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(200);

      const body = res.body;

      expect(body.transaksi.totalTransaksi).toBe(0);
      expect(body.transaksi.totalNominalTransaksi).toBe(0);
      expect(body.transaksi.avgTransaksiPerHari).toBe(0);
      expect(body.transaksi.rataRataNominalHarian).toBe(0);
      expect(body.transaksi.hariAktif).toBe(0);

      expect(body.aktivitas.statusAktivitas).toBe('TIDAK_AKTIF');
      expect(body.aktivitas.rataRataTransaksiPerHariAktif).toBe(0);

      expect(body.rasio.rasioMenabung).toBe(0);
      expect(body.rasio.rasioPinjamanTerhadapSimpanan).toBe(0);
      expect(body.rasio.rasioArusKasPribadi).toBe(0);

      expect(Number.isNaN(body.rasio.rasioMenabung)).toBe(false);
      expect(Number.isNaN(body.rasio.rasioPinjamanTerhadapSimpanan)).toBe(
        false,
      );
      expect(Number.isNaN(body.rasio.rasioArusKasPribadi)).toBe(false);
    });

    it('should reject users without laporan.read permission', async () => {
      const user = await registerAndLogin(app, {
        username: 'rekap-nasabah-noaccess',
        email: 'rekap-nasabah-noaccess@test.com',
        password: noAccessPassword,
      });

      const nasabah = await prisma.nasabah.findFirstOrThrow({
        where: { nomorAnggota: 'TST-RKP-001' },
        select: { id: true },
      });

      await authGet(
        app,
        `/api/rekapitulasi/nasabah/${nasabah.id}?bulan=${bulan}&tahun=${tahun}`,
        user.accessToken,
      ).expect(403);
    });

    it('should return 404 when nasabah is not found', async () => {
      await authGet(
        app,
        `/api/rekapitulasi/nasabah/999999?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(404);
    });
  });
});
