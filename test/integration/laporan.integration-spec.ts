import { INestApplication } from '@nestjs/common';
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
import { createFullNasabah } from '../helpers/factory.helper';

describe('Laporan Module (Integration)', () => {
  let app: INestApplication;
  let adminToken: string;

  const bulan = new Date().getMonth() + 1;
  const tahun = new Date().getFullYear();

  beforeAll(async () => {
    app = await createTestApp();
    await cleanupDatabase(getPrisma());
    await seedDatabase(getPrisma());
    const tokens = await loginAsAdmin(app);
    adminToken = tokens.accessToken;

    // Create some data for reports
    const { nasabah, rekeningList } = await createFullNasabah(app, adminToken);
    const sukarela = rekeningList.find(
      (r: { jenisSimpanan: string }) => r.jenisSimpanan === 'SUKARELA',
    )!;

    // Create a setoran so reports have data
    await authPost(
      app,
      `/api/simpanan/rekening/${sukarela.id}/setoran`,
      adminToken,
    )
      .send({ nominal: 1000000, metodePembayaran: 'CASH' })
      .expect(201);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  describe('GET /api/rekapitulasi/bulanan', () => {
    it('should get laporan bulanan', async () => {
      const res = await authGet(
        app,
        `/api/rekapitulasi/bulanan?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(200);

      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/rekapitulasi/transaksi', () => {
    it('should get laporan transaksi', async () => {
      const res = await authGet(
        app,
        `/api/rekapitulasi/transaksi?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(200);

      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/rekapitulasi/simpanan', () => {
    it('should get laporan simpanan', async () => {
      const res = await authGet(
        app,
        `/api/rekapitulasi/simpanan?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(200);

      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/rekapitulasi/pinjaman', () => {
    it('should get laporan pinjaman', async () => {
      const res = await authGet(
        app,
        `/api/rekapitulasi/pinjaman?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(200);

      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/rekapitulasi/angsuran', () => {
    it('should get laporan angsuran', async () => {
      const res = await authGet(
        app,
        `/api/rekapitulasi/angsuran?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(200);

      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/rekapitulasi/penarikan', () => {
    it('should get laporan penarikan', async () => {
      const res = await authGet(
        app,
        `/api/rekapitulasi/penarikan?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(200);

      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/rekapitulasi/cashflow', () => {
    it('should get laporan cashflow', async () => {
      const res = await authGet(
        app,
        `/api/rekapitulasi/cashflow?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(200);

      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/rekapitulasi/anggota', () => {
    it('should get laporan anggota', async () => {
      const res = await authGet(
        app,
        `/api/rekapitulasi/anggota?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(200);

      expect(res.body.data).toBeDefined();
    });
  });

  describe('Laporan Keuangan flow', () => {
    let laporanKeuanganId: number;

    it('should generate laporan keuangan', async () => {
      const res = await authPost(
        app,
        `/api/laporan/keuangan/generate?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(201);

      expect(res.body.data).toHaveProperty('id');
      laporanKeuanganId = res.body.data.id;
    });

    it('should get laporan keuangan', async () => {
      const res = await authGet(
        app,
        `/api/laporan/keuangan?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(200);

      expect(res.body.periodeBulan).toBe(bulan);
      expect(res.body.periodeTahun).toBe(tahun);
      expect(res.body).toHaveProperty('saldoAwal');
      expect(res.body).toHaveProperty('totalPemasukan');
      expect(res.body).toHaveProperty('totalPengeluaran');
      expect(res.body).toHaveProperty('netCashflow');
      expect(res.body).toHaveProperty('saldoAkhir');
      expect(res.body).toHaveProperty('statusLaporan');
      expect(res.body).toHaveProperty('generatedById');
      expect(res.body).toHaveProperty('generatedAt');
    });

    it('should get latest laporan keuangan when period is omitted', async () => {
      const res = await authGet(
        app,
        '/api/laporan/keuangan',
        adminToken,
      ).expect(200);

      expect(res.body.periodeBulan).toBe(bulan);
      expect(res.body.periodeTahun).toBe(tahun);
    });

    it('should finalize laporan keuangan', async () => {
      if (!laporanKeuanganId) return;

      const res = await authPost(
        app,
        `/api/laporan/keuangan/${laporanKeuanganId}/finalize`,
        adminToken,
      ).expect(201);

      expect(res.body.data).toHaveProperty('statusLaporan', 'FINAL');

      const latestRes = await authGet(
        app,
        `/api/laporan/keuangan?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(200);

      expect(latestRes.body.statusLaporan).toBe('FINAL');
    });
  });

  describe('Authorization', () => {
    it('should reject non-admin/pimpinan access', async () => {
      const user = await registerAndLogin(app, {
        username: 'laporannonadmin',
        email: 'laporannonadmin@test.com',
        password: 'NoAdmin123!',
      });

      await authGet(
        app,
        `/api/rekapitulasi/bulanan?bulan=${bulan}&tahun=${tahun}`,
        user.accessToken,
      ).expect(403);
    });
  });
});
