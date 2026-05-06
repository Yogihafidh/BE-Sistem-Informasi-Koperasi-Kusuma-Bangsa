import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  cleanupDatabase,
  seedDatabase,
  closeTestApp,
  getPrisma,
} from '../helpers/test-app.helper';
import {
  authGet,
  loginAsAdmin,
  registerAndLogin,
} from '../helpers/auth.helper';

/**
 * Integration test untuk memvalidasi endpoint modul Audit.
 *
 * Tujuan:
 * - Memastikan data audit trail dapat diakses dengan format yang benar
 * - Memastikan fitur filter dan pagination berjalan konsisten
 * - Mencegah regression pada endpoint audit yang dipakai monitoring aktivitas
 */
describe('Audit Module (Integration)', () => {
  let app: INestApplication;
  let adminToken: string;

  type AuditTrailItem = {
    id: string;
    action: string;
    createdAt: string;
  };

  type ListResponseBody = {
    data: AuditTrailItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };

  beforeAll(async () => {
    // Inisialisasi aplikasi NestJS dalam mode testing
    app = await createTestApp();

    // Reset database untuk memastikan kondisi awal selalu bersih dan konsisten
    await cleanupDatabase(getPrisma());

    // Isi database dengan data awal untuk kebutuhan skenario integration
    await seedDatabase(getPrisma());

    // Login sebagai admin untuk mendapatkan access token endpoint protected
    const admin = await loginAsAdmin(app);
    adminToken = admin.accessToken;

    // Create additional audit entries to ensure list/filter coverage.
    await authGet(app, '/api/profile', adminToken).expect(200);
    await authGet(app, '/api/settings', adminToken).expect(200);
  });

  afterAll(async () => {
    // Menutup koneksi aplikasi setelah seluruh test selesai dijalankan
    await closeTestApp(app);
  });

  describe('GET /api/audit-trails', () => {
    // Ambil daftar audit trail dengan filter dan pagination
    it('should list audit trails with pagination', async () => {
      const res = await authGet(
        app,
        '/api/audit-trails?page=1&limit=10',
        adminToken,
      ).expect(200);

      const body = res.body as ListResponseBody;

      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.pagination).toHaveProperty('page', 1);
      expect(body.pagination).toHaveProperty('limit', 10);
      expect(body.pagination).toHaveProperty('total');
      expect(body.pagination).toHaveProperty('totalPages');
    });

    // Ambil daftar audit trail dengan filter dan pagination
    it('should filter audit trails by action', async () => {
      const res = await authGet(
        app,
        '/api/audit-trails?action=LOGIN',
        adminToken,
      ).expect(200);

      const body = res.body as ListResponseBody;

      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBeGreaterThan(0);
      for (const item of body.data) {
        expect(item.action).toBe('LOGIN');
      }
    });

    // Input tidak valid harus ditolak -> 400
    it('should reject invalid date query', async () => {
      await authGet(
        app,
        '/api/audit-trails?fromDate=not-a-date',
        adminToken,
      ).expect(400);
    });
  });

  describe('GET /api/audit-trails/:id', () => {
    // Data audit trail per id harus terbaca dengan benar
    it('should get detail of specific audit trail', async () => {
      const list = await authGet(
        app,
        '/api/audit-trails?limit=1',
        adminToken,
      ).expect(200);

      const listBody = list.body as ListResponseBody;
      const id = listBody.data[0]?.id;

      expect(id).toBeDefined();

      const res = await authGet(
        app,
        `/api/audit-trails/${id}`,
        adminToken,
      ).expect(200);

      const detail = res.body as { data: AuditTrailItem };

      expect(detail.data).toHaveProperty('id', id);
      expect(detail.data).toHaveProperty('action');
      expect(detail.data).toHaveProperty('createdAt');
    });

    // Cari audit trail dengan id yang tidak ada -> harus 404
    it('should return 404 for non-existent audit trail', async () => {
      await authGet(
        app,
        '/api/audit-trails/00000000-0000-0000-0000-000000000000',
        adminToken,
      ).expect(404);
    });

    // Payload yang salah format tidak boleh diproses -> 400
    it('should return 400 for invalid audit trail id format', async () => {
      await authGet(
        app,
        '/api/audit-trails/01b44951-d7d7-42d0-a151-8dacf23d53',
        adminToken,
      ).expect(400);
    });
  });

  describe('Authorization', () => {
    // Proses verifikasi permission harus mengubah status dengan benar
    it('should reject user without audit.read permission', async () => {
      const generatedPassword = `NoPerm${Date.now()}!`;
      const user = await registerAndLogin(app, {
        username: 'audit-no-perm',
        email: 'audit-no-perm@test.com',
        password: generatedPassword,
      });

      await authGet(app, '/api/audit-trails', user.accessToken).expect(403);
    });
  });
});
