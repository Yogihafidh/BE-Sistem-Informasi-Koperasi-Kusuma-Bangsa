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
      expect(res.body.data[0].verifiedById).toBeUndefined();
    });

    it('should return 404 when nasabah does not exist', async () => {
      await authGet(app, '/api/pinjaman/nasabah/99999999', adminToken).expect(
        404,
      );
    });
  });

  describe('GET /api/pinjaman', () => {
    it('should list all pinjaman and filter by status', async () => {
      const res = await authGet(
        app,
        '/api/pinjaman?status=PENDING',
        adminToken,
      ).expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(
        res.body.data.every(
          (item: { status: string }) => item.status === 'PENDING',
        ),
      ).toBe(true);
      expect(res.body.data[0]).toHaveProperty('bungaPersen');
      expect(res.body.data[0]).toHaveProperty('nasabah');
      expect(res.body.data[0].nasabah).toHaveProperty('nama');
      expect(res.body.data[0].nasabahId).toBeUndefined();
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.limit).toBe(20);
      expect(res.body.pagination).toHaveProperty('nextCursor');
      expect(typeof res.body.pagination.hasNext).toBe('boolean');
    });

    it('should sort pinjaman nominal asc and desc', async () => {
      const ascRes = await authGet(
        app,
        '/api/pinjaman?sort=asc',
        adminToken,
      ).expect(200);
      const ascNominal = ascRes.body.data.map(
        (item: { jumlahPinjaman: number | string }) =>
          Number(item.jumlahPinjaman),
      );

      for (let i = 1; i < ascNominal.length; i += 1) {
        expect(ascNominal[i - 1]).toBeLessThanOrEqual(ascNominal[i]);
      }

      const descRes = await authGet(
        app,
        '/api/pinjaman?sort=desc',
        adminToken,
      ).expect(200);
      const descNominal = descRes.body.data.map(
        (item: { jumlahPinjaman: number | string }) =>
          Number(item.jumlahPinjaman),
      );

      for (let i = 1; i < descNominal.length; i += 1) {
        expect(descNominal[i - 1]).toBeGreaterThanOrEqual(descNominal[i]);
      }
    });

    it('should paginate all pinjaman data', async () => {
      const firstBatch = await authGet(
        app,
        '/api/pinjaman?sort=desc',
        adminToken,
      ).expect(200);

      expect(firstBatch.body.data.length).toBeGreaterThanOrEqual(1);
      expect(firstBatch.body.pagination.limit).toBe(20);
      if (firstBatch.body.pagination.hasNext) {
        expect(firstBatch.body.pagination.nextCursor).toBeDefined();
        expect(typeof firstBatch.body.pagination.nextCursor).toBe('number');

        const secondBatch = await authGet(
          app,
          `/api/pinjaman?sort=desc&cursor=${firstBatch.body.pagination.nextCursor}`,
          adminToken,
        ).expect(200);

        expect(secondBatch.body.data.length).toBeGreaterThanOrEqual(1);
        expect(secondBatch.body.data[0].id).not.toBe(
          firstBatch.body.data[0].id,
        );
      }
    });

    it('should get pinjaman detail by id', async () => {
      const res = await authGet(
        app,
        `/api/pinjaman/${pinjamanId}`,
        adminToken,
      ).expect(200);

      expect(res.body.message).toBe('Berhasil mengambil detail data pinjaman');
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data[0].id).toBe(pinjamanId);
      expect(res.body.data[0].nasabah).toHaveProperty('nama');
      if (res.body.data[0].verifiedBy) {
        expect(res.body.data[0].verifiedBy).toHaveProperty('nama');
      }
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
