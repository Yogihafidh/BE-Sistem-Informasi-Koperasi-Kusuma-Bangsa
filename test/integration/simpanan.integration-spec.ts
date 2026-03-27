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

describe('Simpanan Module (Integration)', () => {
  let app: INestApplication;
  let adminToken: string;
  let nasabahId: number;
  let rekeningSukarela: {
    id: number;
    jenisSimpanan: string;
    saldoBerjalan: string;
  };

  beforeAll(async () => {
    app = await createTestApp();
    await cleanupDatabase(getPrisma());
    await seedDatabase(getPrisma());
    const tokens = await loginAsAdmin(app);
    adminToken = tokens.accessToken;

    // Create a verified nasabah (auto-creates 3 rekening)
    const { nasabah, rekeningList } = await createFullNasabah(app, adminToken);
    nasabahId = nasabah.id;

    rekeningSukarela = rekeningList.find(
      (r: { jenisSimpanan: string }) => r.jenisSimpanan === 'SUKARELA',
    )!;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  describe('GET /api/simpanan/nasabah/:nasabahId', () => {
    it('should list 3 rekening simpanan for verified nasabah', async () => {
      const res = await authGet(
        app,
        `/api/simpanan/nasabah/${nasabahId}`,
        adminToken,
      ).expect(200);

      expect(res.body.data).toHaveLength(3);
    });

    it('should return 404 for non-existent nasabah', async () => {
      await authGet(app, '/api/simpanan/nasabah/99999', adminToken).expect(404);
    });
  });

  describe('POST /api/simpanan/rekening/:id/setoran', () => {
    it('should process setoran on SUKARELA rekening', async () => {
      const res = await authPost(
        app,
        `/api/simpanan/rekening/${rekeningSukarela.id}/setoran`,
        adminToken,
      )
        .send({
          nominal: 500000,
          metodePembayaran: 'CASH',
        })
        .expect(201);

      expect(res.body.message).toContain('berhasil');
      expect(res.body.data).toHaveProperty('nominal');
    });

    it('should update saldo after setoran', async () => {
      const res = await authGet(
        app,
        `/api/simpanan/nasabah/${nasabahId}`,
        adminToken,
      ).expect(200);

      const rekening = res.body.data.find(
        (item: { id: number }) => item.id === rekeningSukarela.id,
      );
      expect(rekening).toBeDefined();

      const saldo = Number.parseFloat(rekening.saldoBerjalan);
      expect(saldo).toBeGreaterThanOrEqual(500000);
    });

    it('should reject invalid nominal', async () => {
      await authPost(
        app,
        `/api/simpanan/rekening/${rekeningSukarela.id}/setoran`,
        adminToken,
      )
        .send({
          nominal: -100,
          metodePembayaran: 'CASH',
        })
        .expect(400);
    });
  });

  describe('POST /api/simpanan/rekening/:id/penarikan', () => {
    it('should process penarikan when saldo sufficient', async () => {
      // First deposit enough
      await authPost(
        app,
        `/api/simpanan/rekening/${rekeningSukarela.id}/setoran`,
        adminToken,
      )
        .send({ nominal: 1000000, metodePembayaran: 'CASH' })
        .expect(201);

      const res = await authPost(
        app,
        `/api/simpanan/rekening/${rekeningSukarela.id}/penarikan`,
        adminToken,
      )
        .send({
          nominal: 200000,
          metodePembayaran: 'TRANSFER',
        })
        .expect(201);

      expect(res.body.message).toContain('berhasil');
    });

    it('should reject penarikan exceeding saldo', async () => {
      await authPost(
        app,
        `/api/simpanan/rekening/${rekeningSukarela.id}/penarikan`,
        adminToken,
      )
        .send({
          nominal: 999999999,
          metodePembayaran: 'CASH',
        })
        .expect(400);
    });
  });

  describe('GET /api/simpanan/rekening/:id/transaksi', () => {
    it('should list transaksi history with cursor pagination', async () => {
      const res = await authGet(
        app,
        `/api/simpanan/rekening/${rekeningSukarela.id}/transaksi`,
        adminToken,
      ).expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.pagination).toBeDefined();
    });
  });

  describe('DELETE /api/simpanan/rekening/:id', () => {
    it('should reject soft-delete when saldo is still greater than zero', async () => {
      await authDelete(
        app,
        `/api/simpanan/rekening/${rekeningSukarela.id}`,
        adminToken,
      ).expect(400);
    });

    it('should soft-delete rekening with zero saldo', async () => {
      const { nasabah, rekeningList } = await createFullNasabah(
        app,
        adminToken,
      );
      const rekeningZero = rekeningList.find(
        (item: { saldoBerjalan: string }) =>
          Number.parseFloat(item.saldoBerjalan) === 0,
      );

      expect(rekeningZero).toBeDefined();

      const res = await authDelete(
        app,
        `/api/simpanan/rekening/${rekeningZero!.id}`,
        adminToken,
      ).expect(200);

      expect(res.body.message).toBe('Rekening simpanan berhasil dihapus');

      const listRes = await authGet(
        app,
        `/api/simpanan/nasabah/${nasabah.id}`,
        adminToken,
      ).expect(200);
      expect(
        listRes.body.data.find(
          (item: { id: number }) => item.id === rekeningZero!.id,
        ),
      ).toBeUndefined();
    });
  });
});
