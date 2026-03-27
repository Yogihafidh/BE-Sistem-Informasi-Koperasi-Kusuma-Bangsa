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

describe('Nasabah Module (Integration)', () => {
  let app: INestApplication;
  let adminToken: string;
  let pegawaiUserId: number;
  let reassignedPegawaiId: number;

  beforeAll(async () => {
    app = await createTestApp();
    await cleanupDatabase(getPrisma());
    await seedDatabase(getPrisma());
    const tokens = await loginAsAdmin(app);
    adminToken = tokens.accessToken;

    // Create user for pegawai + pegawai (needed to create nasabah)
    const userRes = await registerUser(app, {
      username: 'nasabahpegawai',
      email: 'nasabahpegawai@test.com',
      password: 'NasabahPeg123!',
    });
    pegawaiUserId = userRes.user.id;
    await createTestPegawai(app, adminToken, pegawaiUserId);

    // Assign Admin role so this pegawai-linked user can create nasabah
    const rolesRes = await authGet(app, '/api/roles', adminToken).expect(200);
    const adminRole = rolesRes.body.data.find(
      (r: { name: string }) => r.name === 'Admin',
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
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  let nasabahId: number;

  describe('POST /api/nasabah', () => {
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
    it('should list nasabah with pagination', async () => {
      const res = await authGet(app, '/api/nasabah', adminToken).expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.pagination).toBeDefined();
    });
  });

  describe('GET /api/nasabah/:id', () => {
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

    it('should return 404 for non-existent nasabah', async () => {
      await authGet(app, '/api/nasabah/99999', adminToken).expect(404);
    });
  });

  describe('PATCH /api/nasabah/:id', () => {
    it('should update nasabah data', async () => {
      const res = await authPatch(app, `/api/nasabah/${nasabahId}`, adminToken)
        .send({ alamat: 'Jl. Updated No. 99', pekerjaan: 'PNS' })
        .expect(200);

      expect(res.body.data.alamat).toBe('Jl. Updated No. 99');
      expect(res.body.data.pekerjaan).toBe('PNS');
    });

    it('should update pegawai penanggung jawab nasabah', async () => {
      const res = await authPatch(app, `/api/nasabah/${nasabahId}`, adminToken)
        .send({ pegawaiId: reassignedPegawaiId })
        .expect(200);

      expect(res.body.data.pegawaiId).toBe(reassignedPegawaiId);
      expect(res.body.data.pegawai.id).toBe(reassignedPegawaiId);
    });

    it('should return 404 when pegawaiId does not exist', async () => {
      await authPatch(app, `/api/nasabah/${nasabahId}`, adminToken)
        .send({ pegawaiId: 99999 })
        .expect(404);
    });
  });

  describe('PATCH /api/nasabah/:id/verifikasi', () => {
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
