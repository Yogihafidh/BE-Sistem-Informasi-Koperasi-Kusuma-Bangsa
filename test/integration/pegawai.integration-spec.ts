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
  registerUser,
  authGet,
  authPost,
  authPatch,
} from '../helpers/auth.helper';

/**
 * Integration test untuk memvalidasi endpoint modul Pegawai.
 *
 * Tujuan:
 * - Memastikan proses CRUD pegawai berjalan sesuai aturan bisnis
 * - Memastikan validasi request dan relasi user-pegawai konsisten
 * - Mencegah regression pada endpoint manajemen pegawai
 */
describe('Pegawai Module (Integration)', () => {
  let app: INestApplication;
  let adminToken: string;
  let testUserId: number;
  let createdPegawaiId: number;

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

    // Create a user for pegawai
    const userRes = await registerUser(app, {
      username: 'pegawaiuser1',
      email: 'pegawai1@test.com',
      password: 'Pegawai123!',
    });
    testUserId = userRes.user.id;
  });

  afterAll(async () => {
    // Menutup koneksi aplikasi setelah seluruh test selesai dijalankan
    await closeTestApp(app);
  });

  describe('POST /api/pegawai', () => {
    // Pegawai baru harus langsung tersedia setelah dibuat
    it('should create pegawai successfully', async () => {
      const res = await authPost(app, '/api/pegawai', adminToken)
        .send({
          userId: testUserId,
          nama: 'Budi Pegawai',
          jabatan: 'Kasir',
          noHp: '081299998888',
          alamat: 'Jl. Pegawai No. 1',
        })
        .expect(201);

      expect(res.body.message).toBe('Pegawai berhasil dibuat');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.nama).toBe('Budi Pegawai');
      expect(res.body.data.statusAktif).toBe(true);
      createdPegawaiId = res.body.data.id;
    });

    // Coba simpan pegawai duplikat -> harus 409
    it('should reject duplicate user as pegawai', async () => {
      await authPost(app, '/api/pegawai', adminToken)
        .send({
          userId: testUserId,
          nama: 'Duplicate',
          jabatan: 'Staff',
          noHp: '081200000000',
          alamat: 'Duplicate',
        })
        .expect(409);
    });

    // Payload yang salah format tidak boleh diproses -> 400
    it('should reject invalid DTO', async () => {
      await authPost(app, '/api/pegawai', adminToken)
        .send({ nama: 'No userId' })
        .expect(400);
    });

    // Gunakan userId yang tidak ada -> harus 404
    it('should reject non-existent userId', async () => {
      await authPost(app, '/api/pegawai', adminToken)
        .send({
          userId: 99999,
          nama: 'Ghost User',
          jabatan: 'Staff',
          noHp: '081200000000',
          alamat: 'Nowhere',
        })
        .expect(404);
    });
  });

  describe('GET /api/pegawai', () => {
    // Daftar pegawai yang tampil harus sesuai query
    it('should list pegawai with pagination', async () => {
      const res = await authGet(app, '/api/pegawai', adminToken).expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.pagination).toHaveProperty('nextCursor');
      expect(res.body.pagination).toHaveProperty('hasNext');
    });
  });

  describe('GET /api/pegawai/:id', () => {
    // Data pegawai per id harus terbaca dengan benar
    it('should get pegawai by id', async () => {
      const res = await authGet(
        app,
        `/api/pegawai/${createdPegawaiId}`,
        adminToken,
      ).expect(200);

      expect(res.body.data.id).toBe(createdPegawaiId);
      expect(res.body.data.nama).toBe('Budi Pegawai');
      expect(res.body.data.user).toHaveProperty('username');
    });

    // Ambil pegawai yang tidak ada -> harus 404
    it('should return 404 for non-existent id', async () => {
      await authGet(app, '/api/pegawai/99999', adminToken).expect(404);
    });
  });

  describe('PATCH /api/pegawai/:id', () => {
    // Update pegawai -> perubahan harus tersimpan
    it('should update pegawai data', async () => {
      const res = await authPatch(
        app,
        `/api/pegawai/${createdPegawaiId}`,
        adminToken,
      )
        .send({ jabatan: 'Kasir Senior', noHp: '081277776666' })
        .expect(200);

      expect(res.body.data.jabatan).toBe('Kasir Senior');
      expect(res.body.data.noHp).toBe('081277776666');
    });
  });

  describe('PATCH /api/pegawai/:id/status', () => {
    // Status pegawai harus bisa diaktifkan dan dinonaktifkan
    it('should toggle pegawai status', async () => {
      const res = await authPatch(
        app,
        `/api/pegawai/${createdPegawaiId}/status`,
        adminToken,
      )
        .send({ statusAktif: false })
        .expect(200);

      expect(res.body.data.statusAktif).toBe(false);

      // Re-activate
      const res2 = await authPatch(
        app,
        `/api/pegawai/${createdPegawaiId}/status`,
        adminToken,
      )
        .send({ statusAktif: true })
        .expect(200);

      expect(res2.body.data.statusAktif).toBe(true);
    });
  });
});
