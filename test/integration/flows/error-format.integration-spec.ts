import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  createTestApp,
  cleanupDatabase,
  seedDatabase,
  closeTestApp,
  getPrisma,
} from '../../helpers/test-app.helper';
import {
  loginAsAdmin,
  authGet,
  authPost,
  registerAndLogin,
} from '../../helpers/auth.helper';

/**
 * Integration test untuk memastikan seluruh error response di sistem
 * memiliki format yang konsisten:
 * { statusCode, message, timestamp, path }
 *
 * Tujuan:
 * - Menjaga kontrak API agar mudah dikonsumsi frontend
 * - Memastikan semua error diproses melalui global exception handler
 * - Mencegah perubahan format error (regression) di masa depan
 */
describe('Error Response Format Consistency (Integration)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    // Inisialisasi aplikasi NestJS dalam mode testing
    app = await createTestApp();

    // Reset database untuk memastikan kondisi awal selalu bersih dan konsisten
    await cleanupDatabase(getPrisma());

    // Isi database dengan data awal (seperti akun admin)
    await seedDatabase(getPrisma());

    // Login sebagai admin untuk mendapatkan access token (digunakan di endpoint protected)
    const tokens = await loginAsAdmin(app);
    adminToken = tokens.accessToken;
  });

  afterAll(async () => {
    // Menutup koneksi aplikasi setelah seluruh test selesai dijalankan
    await closeTestApp(app);
  });

  /**
   * Helper function untuk memvalidasi bahwa response error
   * mengikuti format standar yang telah ditentukan
   */
  function assertErrorFormat(
    body: Record<string, unknown>,
    expectedStatus: number,
  ) {
    // Memastikan statusCode sesuai dengan yang diharapkan
    expect(body).toHaveProperty('statusCode', expectedStatus);

    // Memastikan terdapat pesan error (bisa string atau array)
    expect(body).toHaveProperty('message');

    // Memastikan terdapat timestamp sebagai waktu terjadinya error
    expect(body).toHaveProperty('timestamp');

    // Memastikan terdapat path endpoint yang diakses
    expect(body).toHaveProperty('path');

    // Memastikan timestamp memiliki format ISO yang valid
    expect(new Date(body.timestamp as string).toISOString()).toBe(
      body.timestamp,
    );
  }

  describe('401 Unauthorized', () => {
    // Akses tanpa token valid -> harus 401
    it('should return standard format for unauthenticated request', async () => {
      const res = await request(app.getHttpServer() as App)
        .get('/api/pegawai')
        .expect(401);

      assertErrorFormat(res.body, 401);
    });
  });

  describe('403 Forbidden', () => {
    // Akses dengan role yang salah wajib ditolak -> 403
    it('should return standard format for unauthorized role', async () => {
      const user = await registerAndLogin(app, {
        username: 'errfmt_user',
        email: 'errfmt@test.com',
        password: 'ErrFmt123!',
      });

      const res = await authGet(app, '/api/settings', user.accessToken).expect(
        403,
      );

      assertErrorFormat(res.body, 403);
    });
  });

  describe('404 Not Found', () => {
    // Cari data dengan id yang tidak ada -> harus 404
    it('should return standard format for non-existent resource', async () => {
      const res = await authGet(app, '/api/pegawai/99999', adminToken).expect(
        404,
      );

      assertErrorFormat(res.body, 404);
    });

    // Akses path yang tidak ada -> harus 404
    it('should return standard format for non-existent route', async () => {
      const res = await authGet(app, '/api/nonexistent', adminToken).expect(
        404,
      );

      assertErrorFormat(res.body, 404);
    });
  });

  describe('400 Bad Request (Validation)', () => {
    // Kirim payload kosong -> format error validasi harus konsisten
    it('should return standard format with validation messages', async () => {
      const res = await authPost(app, '/api/pegawai', adminToken)
        .send({})
        .expect(400);

      assertErrorFormat(res.body, 400);

      expect(
        Array.isArray(res.body.message) || typeof res.body.message === 'string',
      ).toBe(true);
    });
  });

  describe('409 Conflict', () => {
    // Kirim data register duplikat -> format error harus konsisten
    it('should return standard format for duplicate resource', async () => {
      // Register pertama (berhasil)
      await request(app.getHttpServer() as App)
        .post('/api/register')
        .send({
          username: 'errfmt_dup',
          email: 'errfmt_dup@test.com',
          password: 'ErrFmtDup123!',
        })
        .expect(201);

      // Register kedua (harus gagal karena duplikasi)
      const res = await request(app.getHttpServer() as App)
        .post('/api/register')
        .send({
          username: 'errfmt_dup',
          email: 'errfmt_dup2@test.com',
          password: 'ErrFmtDup123!',
        })
        .expect(409);

      assertErrorFormat(res.body, 409);
    });
  });
});
