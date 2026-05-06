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

/**
 * Integration test untuk memvalidasi endpoint modul Pinjaman.
 *
 * Tujuan:
 * - Memastikan proses pengajuan, verifikasi, dan pengelolaan pinjaman konsisten
 * - Memastikan validasi nominal, status, dan relasi data berjalan benar
 * - Mencegah regression pada alur kredit nasabah
 */
describe('Pinjaman Module (Integration)', () => {
  let app: INestApplication;
  let adminToken: string;
  let nasabahId: number;

  beforeAll(async () => {
    // Inisialisasi aplikasi NestJS dalam mode testing
    app = await createTestApp();

    // Reset database untuk memastikan kondisi awal selalu bersih dan konsisten
    await cleanupDatabase(getPrisma());

    // Isi database dengan data awal untuk kebutuhan skenario integration
    await seedDatabase(getPrisma());

    // Login sebagai admin untuk mendapatkan access token endpoint protected
    const tokens = await loginAsAdmin(app);
    adminToken = tokens.accessToken;

    // Create verified nasabah
    const { nasabah, rekeningList } = await createFullNasabah(app, adminToken);
    nasabahId = nasabah.id;

    const rekeningPokok = rekeningList.find(
      (item: { jenisSimpanan: string }) => item.jenisSimpanan === 'POKOK',
    );
    expect(rekeningPokok).toBeDefined();

    await authPost(
      app,
      `/api/simpanan/rekening/${rekeningPokok!.id}/setoran`,
      adminToken,
    )
      .send({ nominal: 50000, metodePembayaran: 'CASH' })
      .expect(201);
  });

  afterAll(async () => {
    // Menutup koneksi aplikasi setelah seluruh test selesai dijalankan
    await closeTestApp(app);
  });

  let pinjamanId: number;
  let autoApprovedPinjamanId: number;

  describe('POST /api/pinjaman', () => {
    // Pembuatan pinjaman harus menyimpan data yang valid
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
      expect(res.body.data).not.toHaveProperty('totalKewajiban');
      autoApprovedPinjamanId = res.body.data.id;
    });

    // Buat pinjaman baru -> proses harus berhasil
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

    // Payload yang salah format tidak boleh diproses -> 400
    it('should reject pinjaman exceeding max amount', async () => {
      await authPost(app, '/api/pinjaman', adminToken)
        .send({
          nasabahId,
          jumlahPinjaman: 999999999,
          tenorBulan: 6,
        })
        .expect(400);
    });

    // Cari nasabah dengan id yang tidak ada -> harus 404
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
    // List nasabah harus mengikuti parameter query
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

    // Ambil nasabah yang tidak ada -> harus 404
    it('should return 404 when nasabah does not exist', async () => {
      await authGet(app, '/api/pinjaman/nasabah/99999999', adminToken).expect(
        404,
      );
    });
  });

  describe('GET /api/pinjaman', () => {
    // Ubah status pinjaman -> hasilnya harus sesuai request
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

    // Ambil daftar pinjaman dengan filter dan pagination
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

    // List pinjaman harus mengikuti parameter query
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

    // Detail pinjaman yang diminta harus kembali lengkap
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
    // Proses verifikasi pinjaman harus mengubah status dengan benar
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

    // Proses verifikasi pinjaman harus mengubah status dengan benar
    it('should reject re-verification of already verified pinjaman', async () => {
      await authPatch(app, `/api/pinjaman/${pinjamanId}/verifikasi`, adminToken)
        .send({ status: 'DISETUJUI' })
        .expect(400);
    });
  });

  describe('POST /api/pinjaman/:id/pencairan', () => {
    // Proses verifikasi pinjaman harus mengubah status dengan benar
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

      const detailRes = await authGet(
        app,
        `/api/pinjaman/${pinjamanId}`,
        adminToken,
      ).expect(200);

      const detail = detailRes.body.data[0] as {
        jumlahPinjaman: string;
        bungaPersen: string;
        tenorBulan: number;
        sisaPinjaman: string;
      };

      const jumlahPinjaman = Number(detail.jumlahPinjaman);
      const bungaPersen = Number(detail.bungaPersen);
      const tenorBulan = Number(detail.tenorBulan);
      const expectedSisaPinjaman =
        jumlahPinjaman + (jumlahPinjaman * bungaPersen * tenorBulan) / 100;

      expect(Number(detail.sisaPinjaman)).toBeCloseTo(expectedSisaPinjaman, 2);
    });

    // Pencairan pinjaman tidak boleh diproses dua kali -> harus 400
    it('should reject duplicate pencairan', async () => {
      await authPost(app, `/api/pinjaman/${pinjamanId}/pencairan`, adminToken)
        .send({
          metodePembayaran: 'CASH',
        })
        .expect(400);
    });
  });

  describe('POST /api/pinjaman/:id/angsuran', () => {
    // Pembayaran angsuran harus mengurangi sisa pinjaman
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

    // Input tidak valid harus ditolak -> 400
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
    // Daftar pinjaman yang tampil harus sesuai query
    it('should list transaksi history for pinjaman', async () => {
      const res = await authGet(
        app,
        `/api/pinjaman/${pinjamanId}/transaksi`,
        adminToken,
      ).expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    // Pinjaman tidak ditemukan -> harus 404
    it('should return 404 for non-existent pinjaman transaksi history', async () => {
      await authGet(app, '/api/pinjaman/99999/transaksi', adminToken).expect(
        404,
      );
    });
  });

  describe('Auto-approved pinjaman flow', () => {
    // Proses verifikasi pinjaman harus mengubah status dengan benar
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

    // Soft delete pinjaman harus menyembunyikan data dari list
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
