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
  authDelete,
  authGet,
  authPost,
} from '../helpers/auth.helper';
import { createFullNasabah } from '../helpers/factory.helper';

describe('Transaksi Module (Integration)', () => {
  let app: INestApplication;
  let adminToken: string;
  let nasabahId: number;
  let rekeningSukarelaId: number;

  beforeAll(async () => {
    app = await createTestApp();
    await cleanupDatabase(getPrisma());
    await seedDatabase(getPrisma());
    const tokens = await loginAsAdmin(app);
    adminToken = tokens.accessToken;

    // Create verified nasabah with rekening
    const { nasabah, rekeningList } = await createFullNasabah(app, adminToken);
    nasabahId = nasabah.id;
    rekeningSukarelaId = rekeningList.find(
      (r: { jenisSimpanan: string }) => r.jenisSimpanan === 'SUKARELA',
    )!.id;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  let createdTransaksiId: number;

  beforeAll(async () => {
    const res = await authPost(
      app,
      `/api/simpanan/rekening/${rekeningSukarelaId}/setoran`,
      adminToken,
    )
      .send({
        nominal: 500000,
        metodePembayaran: 'CASH',
      })
      .expect(201);

    createdTransaksiId = res.body.data.id;
  });

  describe('GET /api/transaksi', () => {
    it('should list all transaksi with pagination', async () => {
      const res = await authGet(app, '/api/transaksi', adminToken).expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by jenisTransaksi', async () => {
      const res = await authGet(
        app,
        '/api/transaksi?jenisTransaksi=SETORAN',
        adminToken,
      ).expect(200);

      for (const trx of res.body.data) {
        expect(trx.jenisTransaksi).toBe('SETORAN');
      }
    });
  });

  describe('GET /api/transaksi/:id', () => {
    it('should get transaksi by id', async () => {
      const res = await authGet(
        app,
        `/api/transaksi/${createdTransaksiId}`,
        adminToken,
      ).expect(200);

      expect(res.body.data.id).toBe(createdTransaksiId);
      expect(res.body.data).toHaveProperty('jenisTransaksi');
      expect(res.body.data).toHaveProperty('nominal');
      expect(res.body.data).toHaveProperty('nasabah');
      expect(res.body.data.nasabah.id).toBe(nasabahId);
      expect(res.body.data.nasabah).toHaveProperty('nomorAnggota');
      expect(res.body.data.nasabah).toHaveProperty('nama');
      expect(res.body.data.nasabah).toHaveProperty('pekerjaan');
      expect(res.body.data).toHaveProperty('pegawai');
      expect(res.body.data.pegawai).toHaveProperty('nama');
      expect(res.body.data.pegawai).toHaveProperty('jabatan');

      if (res.body.data.rekeningSimpananId !== null) {
        expect(res.body.data.rekeningSimpanan).toBeTruthy();
        expect(res.body.data.rekeningSimpanan).toHaveProperty('jenisSimpanan');
      }

      if (res.body.data.pinjamanId !== null) {
        expect(res.body.data.pinjaman).toBeTruthy();
        expect(res.body.data.pinjaman).toHaveProperty('jumlahPinjaman');
        expect(res.body.data.pinjaman).toHaveProperty('sisaPinjaman');
      }
    });
  });

  describe('DELETE /api/transaksi/:id', () => {
    it('should soft-delete transaksi', async () => {
      const res = await authDelete(
        app,
        `/api/transaksi/${createdTransaksiId}`,
        adminToken,
      ).expect(200);

      expect(res.body.message).toBe('Transaksi berhasil dihapus');

      await authGet(
        app,
        `/api/transaksi/${createdTransaksiId}`,
        adminToken,
      ).expect(404);
    });
  });

  describe('GET /api/transaksi/nasabah/:nasabahId', () => {
    it('should list transaksi by nasabah', async () => {
      await authPost(
        app,
        `/api/simpanan/rekening/${rekeningSukarelaId}/setoran`,
        adminToken,
      )
        .send({
          nominal: 100000,
          metodePembayaran: 'CASH',
        })
        .expect(201);

      const res = await authGet(
        app,
        `/api/transaksi/nasabah/${nasabahId}`,
        adminToken,
      ).expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should return 404 when nasabah does not exist', async () => {
      const missingNasabahId = 99999999;

      await authGet(
        app,
        `/api/transaksi/nasabah/${missingNasabahId}`,
        adminToken,
      ).expect(404);
    });
  });

  describe('GET /api/rekening-simpanan/:id/transaksi', () => {
    it('should return 404 when rekening simpanan does not exist', async () => {
      await authGet(
        app,
        '/api/rekening-simpanan/99999999/transaksi',
        adminToken,
      ).expect(404);
    });
  });

  describe('GET /api/transaksi/pegawai/:pegawaiId', () => {
    it('should return 404 when pegawai does not exist', async () => {
      await authGet(app, '/api/transaksi/pegawai/99999999', adminToken).expect(
        404,
      );
    });
  });
});
