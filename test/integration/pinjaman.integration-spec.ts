import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  cleanupDatabase,
  seedDatabase,
  closeTestApp,
  getPrisma,
} from '../helpers/test-app.helper';
import {
  authDelete,
  loginAsAdmin,
  authGet,
  authPost,
  authPatch,
} from '../helpers/auth.helper';
import { createFullNasabah } from '../helpers/factory.helper';

describe('Pinjaman Module (Integration)', () => {
  let app: INestApplication;
  let adminToken: string;
  let nasabahId: number;

  beforeAll(async () => {
    app = await createTestApp();
    await cleanupDatabase(getPrisma());
    await seedDatabase(getPrisma());
    const tokens = await loginAsAdmin(app);
    adminToken = tokens.accessToken;

    // Create verified nasabah
    const { nasabah } = await createFullNasabah(app, adminToken);
    nasabahId = nasabah.id;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  let pinjamanId: number;
  let autoApprovedPinjamanId: number;

  describe('POST /api/pinjaman', () => {
    it('should create pinjaman with auto-approval (≤ 3M)', async () => {
      const res = await authPost(app, '/api/pinjaman', adminToken)
        .send({
          nasabahId,
          jumlahPinjaman: 2000000,
          tenorBulan: 6,
        })
        .expect(201);

      expect(res.body.message).toContain('berhasil');
      expect(res.body.data).toHaveProperty('id');
      autoApprovedPinjamanId = res.body.data.id;
    });

    it('should create pinjaman that requires verification (> 3M)', async () => {
      const res = await authPost(app, '/api/pinjaman', adminToken)
        .send({
          nasabahId,
          jumlahPinjaman: 10000000,
          tenorBulan: 12,
        })
        .expect(201);

      expect(res.body.data).toHaveProperty('id');
      pinjamanId = res.body.data.id;
    });

    it('should reject pinjaman exceeding max amount', async () => {
      await authPost(app, '/api/pinjaman', adminToken)
        .send({
          nasabahId,
          jumlahPinjaman: 999999999,
          tenorBulan: 6,
        })
        .expect(400);
    });

    it('should reject pinjaman for non-existent nasabah', async () => {
      await authPost(app, '/api/pinjaman', adminToken)
        .send({
          nasabahId: 99999,
          jumlahPinjaman: 1000000,
          tenorBulan: 6,
        })
        .expect(404);
    });
  });

  describe('GET /api/pinjaman/nasabah/:nasabahId', () => {
    it('should list pinjaman by nasabah', async () => {
      const res = await authGet(
        app,
        `/api/pinjaman/nasabah/${nasabahId}`,
        adminToken,
      ).expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data[0].nasabah).toBeUndefined();
    });
  });

  describe('PATCH /api/pinjaman/:id/verifikasi', () => {
    it('should verify pinjaman as DISETUJUI', async () => {
      const res = await authPatch(
        app,
        `/api/pinjaman/${pinjamanId}/verifikasi`,
        adminToken,
      )
        .send({ status: 'DISETUJUI', catatan: 'Approved for testing' })
        .expect(200);

      expect(res.body.data.status).toBe('DISETUJUI');
    });

    it('should reject re-verification of already verified pinjaman', async () => {
      await authPatch(app, `/api/pinjaman/${pinjamanId}/verifikasi`, adminToken)
        .send({ status: 'DISETUJUI' })
        .expect(400);
    });
  });

  describe('POST /api/pinjaman/:id/pencairan', () => {
    it('should process pencairan for approved pinjaman', async () => {
      const res = await authPost(
        app,
        `/api/pinjaman/${pinjamanId}/pencairan`,
        adminToken,
      )
        .send({
          metodePembayaran: 'TRANSFER',
        })
        .expect(201);

      expect(res.body.message).toContain('berhasil');
    });

    it('should reject duplicate pencairan', async () => {
      await authPost(app, `/api/pinjaman/${pinjamanId}/pencairan`, adminToken)
        .send({
          metodePembayaran: 'CASH',
        })
        .expect(400);
    });
  });

  describe('POST /api/pinjaman/:id/angsuran', () => {
    it('should process angsuran payment', async () => {
      const res = await authPost(
        app,
        `/api/pinjaman/${pinjamanId}/angsuran`,
        adminToken,
      )
        .send({
          nominal: 1000000,
          metodePembayaran: 'CASH',
        })
        .expect(201);

      expect(res.body.message).toContain('berhasil');
    });

    it('should reject angsuran exceeding sisa pinjaman', async () => {
      await authPost(app, `/api/pinjaman/${pinjamanId}/angsuran`, adminToken)
        .send({
          nominal: 999999999,
          metodePembayaran: 'CASH',
        })
        .expect(400);
    });
  });

  describe('GET /api/pinjaman/:id/transaksi', () => {
    it('should list transaksi history for pinjaman', async () => {
      const res = await authGet(
        app,
        `/api/pinjaman/${pinjamanId}/transaksi`,
        adminToken,
      ).expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should return 404 for non-existent pinjaman transaksi history', async () => {
      await authGet(app, '/api/pinjaman/99999/transaksi', adminToken).expect(
        404,
      );
    });
  });

  describe('Auto-approved pinjaman flow', () => {
    it('should allow pencairan of auto-approved pinjaman', async () => {
      const res = await authPost(
        app,
        `/api/pinjaman/${autoApprovedPinjamanId}/pencairan`,
        adminToken,
      )
        .send({ metodePembayaran: 'CASH' })
        .expect(201);

      expect(res.body.message).toContain('berhasil');
    });
  });

  describe('DELETE /api/pinjaman/:id', () => {
    let toDeletePinjamanId: number;

    beforeAll(async () => {
      const res = await authPost(app, '/api/pinjaman', adminToken)
        .send({
          nasabahId,
          jumlahPinjaman: 1500000,
          tenorBulan: 6,
        })
        .expect(201);

      toDeletePinjamanId = res.body.data.id;
    });

    it('should soft-delete pinjaman', async () => {
      const res = await authDelete(
        app,
        `/api/pinjaman/${toDeletePinjamanId}`,
        adminToken,
      ).expect(200);

      expect(res.body.message).toBe('Pinjaman berhasil dihapus');

      const listRes = await authGet(
        app,
        `/api/pinjaman/nasabah/${nasabahId}`,
        adminToken,
      ).expect(200);

      expect(
        listRes.body.data.find(
          (item: { id: number }) => item.id === toDeletePinjamanId,
        ),
      ).toBeUndefined();
    });
  });
});
