import { INestApplication } from '@nestjs/common';
import { CacheService } from '../../src/common/cache/cache.service';
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
  authPatch,
  authDelete,
  registerAndLogin,
} from '../helpers/auth.helper';
import {
  createFullNasabah,
  createTestNasabah,
  createTestPinjaman,
} from '../helpers/factory.helper';

describe('Dashboard Module (Integration)', () => {
  let app: INestApplication;
  let adminToken: string;
  let cacheService: CacheService;
  const noAccessPassword = ['No', 'Access', '123', '!'].join('');
  const dashboardRegistryKey = 'dashboard:keys';

  const bulan = new Date().getMonth() + 1;
  const tahun = new Date().getFullYear();

  beforeAll(async () => {
    app = await createTestApp();
    cacheService = app.get(CacheService);
    await cleanupDatabase(getPrisma());
    await seedDatabase(getPrisma());
    const tokens = await loginAsAdmin(app);
    adminToken = tokens.accessToken;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  async function getDashboardData() {
    const res = await authGet(
      app,
      `/api/dashboard?bulan=${bulan}&tahun=${tahun}`,
      adminToken,
    ).expect(200);

    return res.body.data as {
      ringkasanKeuangan: {
        totalSimpanan: number;
        totalOutstandingPinjaman: number;
      };
      keanggotaan: {
        anggotaAktif: number;
      };
    };
  }

  async function getDashboardRegistryKeys() {
    const keys = await cacheService.getJson<string[]>(dashboardRegistryKey);
    return Array.isArray(keys) ? keys : [];
  }

  describe('GET /api/dashboard', () => {
    it('should return dashboard summary', async () => {
      const res = await authGet(
        app,
        `/api/dashboard?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(200);

      expect(res.body.data).toBeDefined();
    });

    it('should require bulan and tahun query params', async () => {
      await authGet(app, '/api/dashboard', adminToken).expect(400);
    });

    it('should reject invalid bulan (>12)', async () => {
      await authGet(
        app,
        `/api/dashboard?bulan=13&tahun=${tahun}`,
        adminToken,
      ).expect(400);
    });

    it('should reject invalid tahun (<2000)', async () => {
      await authGet(
        app,
        `/api/dashboard?bulan=1&tahun=1990`,
        adminToken,
      ).expect(400);
    });
  });

  describe('Authorization', () => {
    it('should reject users without dashboard.read permission', async () => {
      const user = await registerAndLogin(app, {
        username: 'dashnoacccess',
        email: 'dashnoaccess@test.com',
        password: noAccessPassword,
      });

      await authGet(
        app,
        `/api/dashboard?bulan=${bulan}&tahun=${tahun}`,
        user.accessToken,
      ).expect(403);
    });
  });

  describe('Dashboard Cache Anti-Stale Guards', () => {
    it('should reset dashboard registry keys after invalidation', async () => {
      await getDashboardData();

      const keysBeforeInvalidation = await getDashboardRegistryKeys();
      expect(keysBeforeInvalidation.length).toBeGreaterThan(0);
      expect(keysBeforeInvalidation).toContain(`dashboard:${tahun}:${bulan}`);

      const nasabah = await createTestNasabah(app, adminToken);
      await authPatch(app, `/api/nasabah/${nasabah.id}/verifikasi`, adminToken)
        .send({ status: 'AKTIF', catatan: 'Registry reset assertion' })
        .expect(200);

      const keysAfterInvalidation = await getDashboardRegistryKeys();
      expect(keysAfterInvalidation).toEqual([]);

      await getDashboardData();

      const keysAfterRebuild = await getDashboardRegistryKeys();
      expect(keysAfterRebuild).toContain(`dashboard:${tahun}:${bulan}`);
    });

    it('should refresh dashboard after creating transaksi', async () => {
      const { rekeningList } = await createFullNasabah(app, adminToken);
      const sukarela = rekeningList.find(
        (r: { jenisSimpanan: string }) => r.jenisSimpanan === 'SUKARELA',
      );

      expect(sukarela).toBeDefined();

      const before = await getDashboardData();

      await authPost(
        app,
        `/api/simpanan/rekening/${sukarela!.id}/setoran`,
        adminToken,
      )
        .send({ nominal: 250000, metodePembayaran: 'CASH' })
        .expect(201);

      const after = await getDashboardData();
      expect(after.ringkasanKeuangan.totalSimpanan).toBeGreaterThan(
        before.ringkasanKeuangan.totalSimpanan,
      );
    });

    it('should refresh dashboard after verifying nasabah', async () => {
      const before = await getDashboardData();
      const nasabah = await createTestNasabah(app, adminToken);

      await authPatch(app, `/api/nasabah/${nasabah.id}/verifikasi`, adminToken)
        .send({ status: 'AKTIF', catatan: 'Cache invalidation test' })
        .expect(200);

      const after = await getDashboardData();
      expect(after.keanggotaan.anggotaAktif).toBe(
        before.keanggotaan.anggotaAktif + 1,
      );
    });

    it('should refresh dashboard after soft deleting pinjaman', async () => {
      const { nasabah } = await createFullNasabah(app, adminToken);
      const pinjaman = await createTestPinjaman(app, adminToken, nasabah.id, {
        jumlahPinjaman: 2000000,
        tenorBulan: 6,
      });

      await authPost(app, `/api/pinjaman/${pinjaman.id}/pencairan`, adminToken)
        .send({ nominal: 2000000, metodePembayaran: 'CASH' })
        .expect(201);

      const before = await getDashboardData();

      await authDelete(app, `/api/pinjaman/${pinjaman.id}`, adminToken).expect(
        200,
      );

      const after = await getDashboardData();
      expect(after.ringkasanKeuangan.totalOutstandingPinjaman).toBeLessThan(
        before.ringkasanKeuangan.totalOutstandingPinjaman,
      );
    });

    it('should refresh dashboard after generating laporan snapshot', async () => {
      const { rekeningList } = await createFullNasabah(app, adminToken);
      const sukarela = rekeningList.find(
        (r: { jenisSimpanan: string }) => r.jenisSimpanan === 'SUKARELA',
      );

      expect(sukarela).toBeDefined();

      await authPost(
        app,
        `/api/simpanan/rekening/${sukarela!.id}/setoran`,
        adminToken,
      )
        .send({ nominal: 100000, metodePembayaran: 'CASH' })
        .expect(201);

      await authPost(
        app,
        `/api/laporan/keuangan/generate?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(201);

      const before = await getDashboardData();

      await authPost(
        app,
        `/api/simpanan/rekening/${sukarela!.id}/setoran`,
        adminToken,
      )
        .send({ nominal: 175000, metodePembayaran: 'CASH' })
        .expect(201);

      await authPost(
        app,
        `/api/laporan/keuangan/generate?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(201);

      const snapshotRes = await authGet(
        app,
        `/api/laporan/keuangan?bulan=${bulan}&tahun=${tahun}`,
        adminToken,
      ).expect(200);

      const after = await getDashboardData();

      expect(after.ringkasanKeuangan.totalSimpanan).toBeGreaterThan(
        before.ringkasanKeuangan.totalSimpanan,
      );
      expect(after.ringkasanKeuangan.totalSimpanan).toBe(
        snapshotRes.body.totalSimpanan,
      );
    });
  });
});
