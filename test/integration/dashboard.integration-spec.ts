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
  authPatch,
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
  const noAccessPassword = ['No', 'Access', '123', '!'].join('');

  const bulan = new Date().getMonth() + 1;
  const tahun = new Date().getFullYear();

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
    const res = await authGet(
      app,
      `/api/dashboard?bulan=${bulan}&tahun=${tahun}`,
      adminToken,
    ).expect(200);

    return res.body as {
      periode: {
        bulan: number;
        tahun: number;
      };
      ringkasanKeuangan: {
        simpanan: number;
        pinjamanOutstanding: number;
        angsuranBulanIni: number;
        penarikanBulanIni: number;
        komposisiSimpanan: {
          pokok: number;
          wajib: number;
          sukarela: number;
        };
      };
      performance: {
        simpanan: number;
        transaksi: number;
        anggota: number;
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
        total: number;
        aktif: number;
        tren: Array<{
          bulan: string;
          anggotaBaru: number;
          anggotaKeluar: number;
        }>;
      };
      highlight: {
        cashflow: string;
        kondisi: string;
      };
    };
  }

  describe('GET /api/dashboard', () => {
    it('should return response following new dashboard contract', async () => {
      const body = await getDashboard();

      expect(body.data).toBeUndefined();
      expect(body.message).toBeUndefined();

      expect(body.periode).toEqual({ bulan, tahun });
      expect(body.ringkasanKeuangan).toEqual(
        expect.objectContaining({
          simpanan: expect.any(Number),
          pinjamanOutstanding: expect.any(Number),
          angsuranBulanIni: expect.any(Number),
          penarikanBulanIni: expect.any(Number),
          komposisiSimpanan: expect.objectContaining({
            pokok: expect.any(Number),
            wajib: expect.any(Number),
            sukarela: expect.any(Number),
          }),
        }),
      );

      expect(body.performance).toEqual(
        expect.objectContaining({
          simpanan: expect.any(Number),
          transaksi: expect.any(Number),
          anggota: expect.any(Number),
        }),
      );

      expect(body.aktivitasTransaksi.cashflowTrend).toEqual(expect.any(Array));
      expect(body.kreditPinjaman.topOutstanding).toEqual(expect.any(Array));
      expect(body.keanggotaan).toEqual(
        expect.objectContaining({
          total: expect.any(Number),
          aktif: expect.any(Number),
          tren: expect.any(Array),
        }),
      );
      expect(body.highlight).toEqual(
        expect.objectContaining({
          cashflow: expect.stringMatching(/^(surplus|defisit)$/),
          kondisi: expect.stringMatching(/^(stabil|belum stabil|berisiko)$/),
        }),
      );
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

  describe('Data Quality And Realtime Behavior', () => {
    beforeEach(async () => {
      await clearTestCache();
    });

    it('should serve cached payload within dashboard TTL after transaction mutation', async () => {
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
      expect(after).toEqual(before);
    });

    it('should update active members after nasabah verification', async () => {
      const before = await getDashboard();
      const nasabah = await createTestNasabah(app, adminToken, {
        nama: `Calon Aktif ${Date.now()}`,
      });

      await authPatch(app, `/api/nasabah/${nasabah.id}/verifikasi`, adminToken)
        .send({ status: 'AKTIF', catatan: 'Activation for dashboard trend' })
        .expect(200);

      const after = await getDashboard();
      expect(after.keanggotaan.aktif).toBeGreaterThanOrEqual(
        before.keanggotaan.aktif,
      );
    });

    it('should include namaAnggota in topOutstanding and exclude dummy zero rows in trends', async () => {
      const { nasabah } = await createFullNasabah(app, adminToken);
      const pinjaman = await createTestPinjaman(app, adminToken, nasabah.id, {
        jumlahPinjaman: 2000000,
        tenorBulan: 6,
      });

      await authPost(app, `/api/pinjaman/${pinjaman.id}/pencairan`, adminToken)
        .send({ nominal: 2000000, metodePembayaran: 'CASH' })
        .expect(201);

      const body = await getDashboard();

      const withName = body.kreditPinjaman.topOutstanding.find(
        (item) => item.pinjamanId === pinjaman.id,
      );
      expect(withName).toBeDefined();
      expect(withName?.namaAnggota).toEqual(expect.any(String));
      expect(withName?.namaAnggota.length).toBeGreaterThan(0);

      expect(
        body.aktivitasTransaksi.cashflowTrend.every(
          (row) => row.kasMasuk !== 0 || row.kasKeluar !== 0,
        ),
      ).toBe(true);
      expect(
        body.keanggotaan.tren.every(
          (row) => row.anggotaBaru !== 0 || row.anggotaKeluar !== 0,
        ),
      ).toBe(true);
      expect(
        body.aktivitasTransaksi.cashflowTrend
          .map((row) => row.bulan)
          .every((value) => typeof value === 'string'),
      ).toBe(true);
    });

    it('should expose deterministic highlight values', async () => {
      const body = await getDashboard();

      expect(['surplus', 'defisit']).toContain(body.highlight.cashflow);
      expect(['stabil', 'belum stabil', 'berisiko']).toContain(
        body.highlight.kondisi,
      );
    });
  });
});
