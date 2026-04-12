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
  loginAs,
  registerUser,
  authGet,
  authPost,
  authPatch,
} from '../helpers/auth.helper';
import { createTestPegawai } from '../helpers/factory.helper';

/**
 * Integration test untuk memvalidasi alur endpoint modul Nasabah.
 *
 * Tujuan:
 * - Memastikan proses registrasi dan pengelolaan data nasabah berjalan benar
 * - Memastikan validasi dan kontrol akses endpoint nasabah konsisten
 * - Mencegah regression pada alur onboarding anggota koperasi
 */
describe('Nasabah Module (Integration)', () => {
  let app: INestApplication;
  let adminToken: string;
  let pegawaiUserId: number;
  let pegawaiId: number;
  let staffPegawaiId: number;
  let staffToken: string;
  let reassignedPegawaiId: number;

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

    // Create user for pegawai + pegawai (needed to create nasabah)
    const userRes = await registerUser(app, {
      username: 'nasabahpegawai',
      email: 'nasabahpegawai@test.com',
      password: 'NasabahPeg123!',
    });
    pegawaiUserId = userRes.user.id;
    const pegawai = await createTestPegawai(app, adminToken, pegawaiUserId);
    pegawaiId = pegawai.id;

    // Assign Admin role so this pegawai-linked user can create nasabah
    const rolesRes = await authGet(app, '/api/roles', adminToken).expect(200);
    const adminRole = rolesRes.body.data.find(
      (r: { name: string }) => r.name === 'Admin',
    );
    const staffRole = rolesRes.body.data.find(
      (r: { name: string }) => r.name === 'Staff',
    );
    await authPost(app, `/api/users/${pegawaiUserId}/roles`, adminToken)
      .send({ roleIds: [adminRole.id] })
      .expect(201);

    const reassignedUser = await registerUser(app, {
      username: 'nasabahpegawai2',
      email: 'nasabahpegawai2@test.com',
      password: 'NasabahPeg456!',
    });

    const reassignedPegawai = await createTestPegawai(
      app,
      adminToken,
      reassignedUser.user.id,
      {
        nama: 'Pegawai Reassign',
        jabatan: 'Staff',
      },
    );
    reassignedPegawaiId = reassignedPegawai.id;

    await authPost(
      app,
      `/api/users/${reassignedUser.user.id}/roles`,
      adminToken,
    )
      .send({ roleIds: [staffRole.id] })
      .expect(201);

    const staffTokens = await loginAs(app, 'nasabahpegawai2', 'NasabahPeg456!');
    staffToken = staffTokens.accessToken;
    staffPegawaiId = reassignedPegawaiId;
  });

  afterAll(async () => {
    // Menutup koneksi aplikasi setelah seluruh test selesai dijalankan
    await closeTestApp(app);
  });

  let nasabahId: number;

  describe('POST /api/nasabah', () => {
    // Status nasabah harus bisa diaktifkan dan dinonaktifkan
    it('should create nasabah with status PENDING', async () => {
      // Login as pegawai user with Admin role
      const pegawaiTokens = await loginAs(
        app,
        'nasabahpegawai',
        'NasabahPeg123!',
      );

      const res = await authPost(app, '/api/nasabah', pegawaiTokens.accessToken)
        .send({
          nama: 'Siti Aminah',
          nik: '3201010101010001',
          alamat: 'Jl. Kenanga No. 12',
          noHp: '081234567890',
          pekerjaan: 'Wiraswasta',
          penghasilanBulanan: 5000000,
          tanggalLahir: '1995-08-17',
        })
        .expect(201);

      expect(res.body.message).toBe('Registrasi nasabah berhasil');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('nomorAnggota');
      expect(res.body.data.status).toBe('PENDING');
      nasabahId = res.body.data.id;
    });

    // Coba simpan nasabah duplikat -> harus 409
    it('should reject duplicate NIK', async () => {
      const pegawaiTokens = await loginAs(
        app,
        'nasabahpegawai',
        'NasabahPeg123!',
      );

      await authPost(app, '/api/nasabah', pegawaiTokens.accessToken)
        .send({
          nama: 'Duplicate NIK',
          nik: '3201010101010001',
          alamat: 'Anywhere',
          noHp: '081200001111',
          pekerjaan: 'PNS',
          penghasilanBulanan: 4000000,
          tanggalLahir: '1990-01-01',
        })
        .expect(409);
    });
  });

  describe('GET /api/nasabah', () => {
    // List nasabah harus mengikuti parameter query
    it('should list nasabah with pagination', async () => {
      const res = await authGet(
        app,
        `/api/nasabah?pegawaiId=${pegawaiId}`,
        adminToken,
      ).expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.pagination).toBeDefined();
    });

    // Status nasabah harus bisa diaktifkan dan dinonaktifkan
    it('should filter nasabah by status PENDING', async () => {
      const res = await authGet(
        app,
        `/api/nasabah?status=PENDING&pegawaiId=${pegawaiId}`,
        adminToken,
      ).expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      for (const nasabah of res.body.data) {
        expect(nasabah.status).toBe('PENDING');
      }
    });

    // Admin bisa lihat semua nasabah tanpa filter pegawai
    it('should allow admin to access all nasabah without pegawaiId filter', async () => {
      const res = await authGet(app, '/api/nasabah', adminToken).expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.pagination).toBeDefined();
    });

    // Staff wajib kirim pegawaiId saat ambil daftar nasabah -> harus 400
    it('should reject staff without pegawaiId query parameter', async () => {
      await authGet(app, '/api/nasabah', staffToken).expect(400);
    });

    // Staff tidak boleh akses nasabah milik pegawai lain -> harus 403
    it('should reject staff requesting nasabah from another pegawai', async () => {
      await authGet(
        app,
        `/api/nasabah?pegawaiId=${pegawaiId}`,
        staffToken,
      ).expect(403);
    });

    // Staff boleh lihat nasabah miliknya sendiri lewat pegawaiId
    it('should allow staff requesting nasabah with own pegawaiId', async () => {
      const res = await authGet(
        app,
        `/api/nasabah?pegawaiId=${staffPegawaiId}`,
        staffToken,
      ).expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.pagination).toBeDefined();
    });

    // Cari pegawai dengan id yang tidak ada -> harus 404
    it('should return 404 when pegawaiId is not found', async () => {
      await authGet(app, '/api/nasabah?pegawaiId=99999', adminToken).expect(
        404,
      );
    });
  });

  describe('GET /api/nasabah/:id', () => {
    // Detail nasabah yang diminta harus kembali lengkap
    it('should get nasabah detail', async () => {
      const pegawaiTokens = await loginAs(
        app,
        'nasabahpegawai',
        'NasabahPeg123!',
      );

      const res = await authGet(
        app,
        `/api/nasabah/${nasabahId}`,
        pegawaiTokens.accessToken,
      ).expect(200);

      expect(res.body.data.id).toBe(nasabahId);
      expect(res.body.data.nama).toBe('Siti Aminah');
      expect(res.body.data.pegawai).toBeDefined();
    });

    // Cari nasabah dengan id yang tidak ada -> harus 404
    it('should return 404 for non-existent nasabah', async () => {
      await authGet(app, '/api/nasabah/99999', adminToken).expect(404);
    });
  });

  describe('POST /api/nasabah/:id/dokumen', () => {
    // Buat nasabah baru -> proses harus berhasil
    it('should upload KTP + KK + slip gaji in one request', async () => {
      const pegawaiTokens = await loginAs(
        app,
        'nasabahpegawai',
        'NasabahPeg123!',
      );

      const res = await authPost(
        app,
        `/api/nasabah/${nasabahId}/dokumen`,
        pegawaiTokens.accessToken,
      )
        .attach('ktp', Buffer.from('fake-ktp-image'), {
          filename: 'ktp.jpg',
          contentType: 'image/jpeg',
        })
        .attach('kk', Buffer.from('fake-kk-image'), {
          filename: 'kk.png',
          contentType: 'image/png',
        })
        .attach('slipGaji', Buffer.from('%PDF-1.4\nfake-slip-gaji'), {
          filename: 'slip-gaji.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      expect(res.body.message).toBe('Upload dokumen berhasil');
      expect(res.body.data).toHaveLength(3);
      const jenisDokumen = res.body.data.map(
        (item: { jenisDokumen: string }) => item.jenisDokumen,
      );
      expect(jenisDokumen).toEqual(
        expect.arrayContaining(['KTP', 'KK', 'SLIP_GAJI']),
      );
    });

    // Coba simpan nasabah duplikat -> harus 400
    it('should reject duplicate dokumen jenis for same nasabah', async () => {
      const pegawaiTokens = await loginAs(
        app,
        'nasabahpegawai',
        'NasabahPeg123!',
      );

      const res = await authPost(
        app,
        `/api/nasabah/${nasabahId}/dokumen`,
        pegawaiTokens.accessToken,
      )
        .attach('ktp', Buffer.from('fake-ktp-image-2'), {
          filename: 'ktp-2.jpg',
          contentType: 'image/jpeg',
        })
        .attach('kk', Buffer.from('fake-kk-image-2'), {
          filename: 'kk-2.png',
          contentType: 'image/png',
        })
        .expect(400);

      expect(res.body.message).toContain('Dokumen KTP, KK sudah ada');
    });
  });

  describe('PATCH /api/nasabah/:id', () => {
    // Data nasabah yang diubah harus terbaca di response
    it('should update nasabah data', async () => {
      const res = await authPatch(app, `/api/nasabah/${nasabahId}`, adminToken)
        .send({ alamat: 'Jl. Updated No. 99', pekerjaan: 'PNS' })
        .expect(200);

      expect(res.body.data.alamat).toBe('Jl. Updated No. 99');
      expect(res.body.data.pekerjaan).toBe('PNS');
    });

    // Perubahan pegawai harus konsisten setelah disimpan
    it('should update pegawai penanggung jawab nasabah', async () => {
      const res = await authPatch(app, `/api/nasabah/${nasabahId}`, adminToken)
        .send({ pegawaiId: reassignedPegawaiId })
        .expect(200);

      expect(res.body.data.pegawaiId).toBe(reassignedPegawaiId);
      expect(res.body.data.pegawai.id).toBe(reassignedPegawaiId);
    });

    // Pegawai tidak ditemukan -> harus 404
    it('should return 404 when pegawaiId does not exist', async () => {
      await authPatch(app, `/api/nasabah/${nasabahId}`, adminToken)
        .send({ pegawaiId: 99999 })
        .expect(404);
    });
  });

  describe('PATCH /api/nasabah/:id/verifikasi', () => {
    // Keputusan verifikasi nasabah harus tercermin di data
    it('should verify nasabah as AKTIF and auto-create rekening simpanan', async () => {
      const res = await authPatch(
        app,
        `/api/nasabah/${nasabahId}/verifikasi`,
        adminToken,
      )
        .send({ status: 'AKTIF', catatan: 'Dokumen lengkap' })
        .expect(200);

      expect(res.body.data.status).toBe('AKTIF');

      // Verify 3 rekening simpanan created
      const rekeningRes = await authGet(
        app,
        `/api/simpanan/nasabah/${nasabahId}`,
        adminToken,
      ).expect(200);

      expect(rekeningRes.body.data).toHaveLength(3);
      const jenisList = rekeningRes.body.data.map(
        (r: { jenisSimpanan: string }) => r.jenisSimpanan,
      );
      expect(jenisList).toContain('POKOK');
      expect(jenisList).toContain('WAJIB');
      expect(jenisList).toContain('SUKARELA');
    });

    // Nasabah yang sudah diverifikasi masih bisa diverifikasi ulang
    it('should allow re-verification of already verified nasabah', async () => {
      const res = await authPatch(
        app,
        `/api/nasabah/${nasabahId}/verifikasi`,
        adminToken,
      )
        .send({ status: 'DITOLAK', catatan: 'Perlu perbaikan data dokumen' })
        .expect(200);

      expect(res.body.data.status).toBe('DITOLAK');
    });
  });

  describe('PATCH /api/nasabah/:id/verifikasi (DITOLAK)', () => {
    let pendingNasabahId: number;

    beforeAll(async () => {
      const pegawaiTokens = await loginAs(
        app,
        'nasabahpegawai',
        'NasabahPeg123!',
      );

      const res = await authPost(app, '/api/nasabah', pegawaiTokens.accessToken)
        .send({
          nama: 'Ditolak Test',
          nik: '3201020202020002',
          alamat: 'Jl. Ditolak',
          noHp: '081299990002',
          pekerjaan: 'Freelancer',
          penghasilanBulanan: 2000000,
          tanggalLahir: '1998-03-15',
        })
        .expect(201);
      pendingNasabahId = res.body.data.id;
    });

    // Keputusan verifikasi nasabah harus tercermin di data
    it('should reject nasabah as DITOLAK', async () => {
      const res = await authPatch(
        app,
        `/api/nasabah/${pendingNasabahId}/verifikasi`,
        adminToken,
      )
        .send({ status: 'DITOLAK', catatan: 'Dokumen tidak lengkap' })
        .expect(200);

      expect(res.body.data.status).toBe('DITOLAK');
    });
  });

  describe('PATCH /api/nasabah/:id/status', () => {
    // Perubahan status nasabah wajib tersimpan
    it('should update status to NONAKTIF', async () => {
      const res = await authPatch(
        app,
        `/api/nasabah/${nasabahId}/status`,
        adminToken,
      )
        .send({ status: 'NONAKTIF' })
        .expect(200);

      expect(res.body.data.status).toBe('NONAKTIF');
    });

    // Status nasabah harus bisa diaktifkan dan dinonaktifkan
    it('should re-activate to AKTIF', async () => {
      const res = await authPatch(
        app,
        `/api/nasabah/${nasabahId}/status`,
        adminToken,
      )
        .send({ status: 'AKTIF' })
        .expect(200);

      expect(res.body.data.status).toBe('AKTIF');
    });
  });
});
