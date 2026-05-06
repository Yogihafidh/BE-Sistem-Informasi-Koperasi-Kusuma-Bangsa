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
  authPut,
  registerAndLogin,
} from '../helpers/auth.helper';

/**
 * Integration test untuk memvalidasi endpoint modul Settings.
 *
 * Tujuan:
 * - Memastikan pembacaan dan perubahan konfigurasi sistem berjalan benar
 * - Memastikan hanya role yang berwenang dapat mengakses endpoint settings
 * - Mencegah regression pada konfigurasi yang memengaruhi aturan bisnis
 */
describe('Settings Module (Integration)', () => {
  let app: INestApplication;
  let adminToken: string;

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
  });

  afterAll(async () => {
    // Menutup koneksi aplikasi setelah seluruh test selesai dijalankan
    await closeTestApp(app);
  });

  describe('GET /api/settings', () => {
    // List setting harus mengikuti parameter query
    it('should list all settings (10 seeded)', async () => {
      const res = await authGet(app, '/api/settings', adminToken).expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('GET /api/settings/:key', () => {
    // Data setting per id harus terbaca dengan benar
    it('should get setting by key', async () => {
      const res = await authGet(
        app,
        '/api/settings/loan.maxLoanAmount',
        adminToken,
      ).expect(200);

      expect(res.body.data).toHaveProperty('key', 'loan.maxLoanAmount');
      expect(res.body.data).toHaveProperty('value');
    });

    // Setting tidak ditemukan -> harus 404
    it('should return 404 for non-existent key', async () => {
      await authGet(app, '/api/settings/nonexistent.key', adminToken).expect(
        404,
      );
    });
  });

  describe('PUT /api/settings/:key', () => {
    // Update setting -> perubahan harus tersimpan
    it('should update existing setting', async () => {
      const res = await authPut(
        app,
        '/api/settings/loan.maxLoanAmount',
        adminToken,
      )
        .send({
          value: '75000000',
          description: 'Updated max',
        })
        .expect(200);

      expect(res.body.data.value).toBe('75000000');
    });

    // Cari setting dengan id yang tidak ada -> harus 404
    it('should return 404 for non-existent setting key', async () => {
      await authPut(app, '/api/settings/custom.newSetting', adminToken)
        .send({
          value: 'hello',
          description: 'New custom setting',
        })
        .expect(404);
    });
  });

  describe('Authorization', () => {
    // Hak akses tidak cukup -> harus 403
    it('should reject non-admin access', async () => {
      const user = await registerAndLogin(app, {
        username: 'settingsnonadmin',
        email: 'settingsnonadmin@test.com',
        password: 'NoAdmin123!',
      });

      await authGet(app, '/api/settings', user.accessToken).expect(403);
    });
  });
});
