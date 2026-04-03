import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  cleanupDatabase,
  seedDatabase,
  closeTestApp,
  getPrisma,
  clearTestCache,
} from '../helpers/test-app.helper';
import {
  loginAsAdmin,
  authGet,
  authPost,
  authPut,
  registerAndLogin,
} from '../helpers/auth.helper';
import {
  createFullNasabah,
  createTestPinjaman,
} from '../helpers/factory.helper';

describe('Dashboard Module (Integration)', () => {
  let app: INestApplication;
  let adminToken: string;
  const noAccessPassword = ['No', 'Access', '123', '!'].join('');

  beforeAll(async () => {
    app = await createTestApp();
    await cleanupDatabase(getPrisma());
    await seedDatabase(getPrisma());
    const tokens = await loginAsAdmin(app);
    adminToken = tokens.accessToken;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  async function getDashboard() {
    const res = await authGet(app, '/api/dashboard', adminToken).expect(200);

    return res.body as {
      context: {
        generatedAt: string;
      };
      ringkasanUtama: {
        totalSimpanan: number;
        totalPinjamanOutstanding: number;
        totalAnggota: number;
        anggotaAktif: number;
      };
      aktivitasTransaksi: {
        cashflowTrend: Array<{
          bulan: string;
          kasMasuk: number;
          kasKeluar: number;
        }>;
      };
      kreditPinjaman: {
        topOutstanding: Array<{
          pinjamanId: number;
          namaAnggota: string;
          nominal: number;
        }>;
      };
      keanggotaan: {
        tren: Array<{
          bulan: string;
          anggotaBaru: number;
          anggotaKeluar: number;
        }>;
      };
    };
  }

  describe('GET /api/dashboard', () => {
    it('should return response following new dashboard contract', async () => {
      const body = await getDashboard();
      const rawBody = body as unknown as Record<string, unknown>;

      expect(rawBody.data).toBeUndefined();
      expect(rawBody.message).toBeUndefined();

      expect(body.context).toEqual(
        expect.objectContaining({
          generatedAt: expect.any(String),
        }),
      );
      expect(body.ringkasanUtama).toEqual(
        expect.objectContaining({
          totalSimpanan: expect.any(Number),
          totalPinjamanOutstanding: expect.any(Number),
          totalAnggota: expect.any(Number),
          anggotaAktif: expect.any(Number),
        }),
      );

      expect(body.aktivitasTransaksi.cashflowTrend).toEqual(expect.any(Array));
      expect(body.kreditPinjaman.topOutstanding).toEqual(expect.any(Array));
      expect(body.keanggotaan).toEqual(
        expect.objectContaining({
          tren: expect.any(Array),
        }),
      );

      expect(rawBody.performance).toBeUndefined();
      expect(rawBody.highlight).toBeUndefined();
      expect(rawBody.ringkasanKeuangan).toBeUndefined();

      expect(new Date(body.context.generatedAt).toISOString()).toBe(
        body.context.generatedAt,
      );
    });

    it('should return dashboard without period query params', async () => {
      await authGet(app, '/api/dashboard', adminToken).expect(200);
    });
  });

  describe('Authorization', () => {
    it('should reject users without dashboard.read permission', async () => {
      const user = await registerAndLogin(app, {
        username: 'dashnoacccess',
        email: 'dashnoaccess@test.com',
        password: noAccessPassword,
      });

      await authGet(app, '/api/dashboard', user.accessToken).expect(403);
    });
  });

  describe('Data Quality And Realtime Behavior', () => {
    beforeEach(async () => {
      await clearTestCache();
    });

    it('should reflect latest data immediately after transaction mutation', async () => {
      const { rekeningList } = await createFullNasabah(app, adminToken);
      const sukarela = rekeningList.find(
        (r: { jenisSimpanan: string }) => r.jenisSimpanan === 'SUKARELA',
      );

      expect(sukarela).toBeDefined();

      const before = await getDashboard();

      await authPost(
        app,
        `/api/simpanan/rekening/${sukarela!.id}/setoran`,
        adminToken,
      )
        .send({ nominal: 250000, metodePembayaran: 'CASH' })
        .expect(201);

      const after = await getDashboard();
      expect(after.context.generatedAt).not.toBe(before.context.generatedAt);
      expect(after.ringkasanUtama.totalSimpanan).toBeGreaterThanOrEqual(
        before.ringkasanUtama.totalSimpanan,
      );
    });

    it('should include namaAnggota in topOutstanding and keep rolling trends fixed-length', async () => {
      const { nasabah } = await createFullNasabah(app, adminToken);
      const pinjaman = await createTestPinjaman(app, adminToken, nasabah.id, {
        jumlahPinjaman: 2000000,
        tenorBulan: 6,
      });

      await authPost(app, `/api/pinjaman/${pinjaman.id}/pencairan`, adminToken)
        .send({ nominal: 2000000, metodePembayaran: 'CASH' })
        .expect(201);

      const body = await getDashboard();
      const trendSettingRes = await authGet(
        app,
        '/api/settings/dashboard.trendMonths',
        adminToken,
      ).expect(200);
      const expectedTrendLength = Number(trendSettingRes.body.data.value);

      const withName = body.kreditPinjaman.topOutstanding.find(
        (item) => item.pinjamanId === pinjaman.id,
      );
      expect(withName).toBeDefined();
      expect(withName?.namaAnggota).toEqual(expect.any(String));
      expect(withName?.namaAnggota.length).toBeGreaterThan(0);

      expect(body.aktivitasTransaksi.cashflowTrend.length).toBe(
        expectedTrendLength,
      );
      expect(body.keanggotaan.tren.length).toBe(expectedTrendLength);
      expect(
        body.aktivitasTransaksi.cashflowTrend
          .map((row) => row.bulan)
          .every((value) => typeof value === 'string'),
      ).toBe(true);

      expect(
        body.keanggotaan.tren
          .map((row) => row.bulan)
          .every((value) => typeof value === 'string'),
      ).toBe(true);
    });

    it('should keep ringkasan utama anggota totals consistent with nasabah endpoint', async () => {
      const dashboard = await getDashboard();
      const nasabahAll = await authGet(app, '/api/nasabah', adminToken).expect(
        200,
      );
      const nasabahAktif = await authGet(
        app,
        '/api/nasabah?status=AKTIF',
        adminToken,
      ).expect(200);

      const totalNasabah =
        nasabahAll.body.pagination?.total ?? nasabahAll.body.data.length;
      const totalNasabahAktif =
        nasabahAktif.body.pagination?.total ?? nasabahAktif.body.data.length;

      expect(dashboard.ringkasanUtama.totalAnggota).toBe(totalNasabah);
      expect(dashboard.ringkasanUtama.anggotaAktif).toBe(totalNasabahAktif);
    });

    it('should follow dashboard trendMonths setting updates', async () => {
      await authPut(app, '/api/settings/dashboard.trendMonths', adminToken)
        .send({ value: '3' })
        .expect(200);

      const body = await getDashboard();

      expect(body.aktivitasTransaksi.cashflowTrend.length).toBe(3);
      expect(body.keanggotaan.tren.length).toBe(3);
    });
  });
});
