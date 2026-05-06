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
  registerAndLogin,
  authGet,
  authPost,
  authPut,
  authPatch,
  authDelete,
} from '../helpers/auth.helper';
import request from 'supertest';
import { App } from 'supertest/types';

/**
 * Integration test untuk memvalidasi RBAC (role-based access control) pada modul Auth.
 *
 * Tujuan:
 * - Memastikan CRUD role dan permission berjalan sesuai aturan
 * - Memastikan assignment role-permission diterapkan dengan benar
 * - Mencegah regression pada kontrol akses endpoint protected
 */
describe('Auth RBAC (Integration)', () => {
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

  // ==================== ROLES CRUD ====================
  describe('Roles CRUD', () => {
    let createdRoleId: number;

    // Buat role baru -> proses harus berhasil
    it('POST /api/roles — should create a new role', async () => {
      const res = await authPost(app, '/api/roles', adminToken)
        .send({ name: 'TestRole', description: 'Role for testing' })
        .expect(201);

      expect(res.body.message).toBe('Role berhasil dibuat');
      expect(res.body.role).toHaveProperty('id');
      expect(res.body.role.name).toBe('TestRole');
      createdRoleId = res.body.role.id;
    });

    // Coba simpan role duplikat -> harus 409
    it('POST /api/roles — should reject duplicate role name', async () => {
      await authPost(app, '/api/roles', adminToken)
        .send({ name: 'TestRole' })
        .expect(409);
    });

    // List role harus mengikuti parameter query
    it('GET /api/roles — should list all roles', async () => {
      const res = await authGet(app, '/api/roles', adminToken).expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(5); // 4 seeded + 1 created
    });

    // Detail role yang diminta harus kembali lengkap
    it('GET /api/roles/:id — should get role by id', async () => {
      const res = await authGet(
        app,
        `/api/roles/${createdRoleId}`,
        adminToken,
      ).expect(200);

      expect(res.body.data.name).toBe('TestRole');
    });

    // Perubahan role harus konsisten setelah disimpan
    it('PUT /api/roles/:id — should update role', async () => {
      const res = await authPut(app, `/api/roles/${createdRoleId}`, adminToken)
        .send({ name: 'UpdatedRole' })
        .expect(200);

      expect(res.body.role.name).toBe('UpdatedRole');
    });

    // Hapus role sesuai aturan bisnis
    it('DELETE /api/roles/:id — should delete role', async () => {
      const res = await authDelete(
        app,
        `/api/roles/${createdRoleId}`,
        adminToken,
      ).expect(200);

      expect(res.body.message).toBe('Role berhasil dihapus');

      // Verify deleted
      await authGet(app, `/api/roles/${createdRoleId}`, adminToken).expect(404);
    });
  });

  // ==================== PERMISSIONS CRUD ====================
  describe('Permissions CRUD', () => {
    let createdPermId: number;

    // Permission baru harus langsung tersedia setelah dibuat
    it('POST /api/permissions — should create permission', async () => {
      const res = await authPost(app, '/api/permissions', adminToken)
        .send({ code: 'test.permission', description: 'Test perm' })
        .expect(201);

      expect(res.body.permission).toHaveProperty('id');
      createdPermId = res.body.permission.id;
    });

    // Data permission duplikat tidak boleh lolos -> harus 409
    it('POST /api/permissions — should reject duplicate code', async () => {
      await authPost(app, '/api/permissions', adminToken)
        .send({ code: 'test.permission' })
        .expect(409);
    });

    // Ambil daftar permission dengan filter dan pagination
    it('GET /api/permissions — should list all permissions', async () => {
      const res = await authGet(app, '/api/permissions', adminToken).expect(
        200,
      );

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(36); // 36 seeded
    });

    // Saat permission dihapus, data terkait harus ikut konsisten
    it('DELETE /api/permissions/:id — should delete permission', async () => {
      await authDelete(
        app,
        `/api/permissions/${createdPermId}`,
        adminToken,
      ).expect(200);
    });
  });

  // ==================== ROLE-PERMISSION ASSIGNMENT ====================
  describe('Role-Permission Assignment', () => {
    let testRoleId: number;

    beforeAll(async () => {
      const res = await authPost(app, '/api/roles', adminToken)
        .send({ name: 'AssignTestRole' })
        .expect(201);
      testRoleId = res.body.role.id;
    });

    // Penugasan role harus tersimpan dengan benar
    it('should assign permissions to role', async () => {
      const permsRes = await authGet(
        app,
        '/api/permissions',
        adminToken,
      ).expect(200);
      const firstTwoIds = permsRes.body.data
        .slice(0, 2)
        .map((p: { id: number }) => p.id);

      const res = await authPost(
        app,
        `/api/roles/${testRoleId}/permissions`,
        adminToken,
      )
        .send({ permissionIds: firstTwoIds })
        .expect(201);

      expect(res.body.message).toContain('berhasil');
    });

    // Penugasan role harus tersimpan dengan benar
    it('should verify role has assigned permissions', async () => {
      const res = await authGet(
        app,
        `/api/roles/${testRoleId}`,
        adminToken,
      ).expect(200);
      expect(res.body.data.permissions.length).toBe(2);
    });

    // Hapus role sesuai aturan bisnis
    it('should remove permission from role', async () => {
      const roleRes = await authGet(
        app,
        `/api/roles/${testRoleId}`,
        adminToken,
      ).expect(200);

      const permissionCode = roleRes.body.data.permissions[0];
      const permissionsRes = await authGet(
        app,
        '/api/permissions',
        adminToken,
      ).expect(200);
      const permId = permissionsRes.body.data.find(
        (permission: { id: number; code: string }) =>
          permission.code === permissionCode,
      )?.id;

      expect(permId).toBeDefined();

      await authDelete(
        app,
        `/api/roles/${testRoleId}/permissions/${permId}`,
        adminToken,
      ).expect(200);

      const updated = await authGet(
        app,
        `/api/roles/${testRoleId}`,
        adminToken,
      ).expect(200);
      expect(updated.body.data.permissions.length).toBe(1);
    });
  });

  // ==================== USER-ROLE ASSIGNMENT ====================
  describe('User-Role Assignment', () => {
    let testUserId: number;

    beforeAll(async () => {
      const result = await registerAndLogin(app, {
        username: 'rbacuser',
        email: 'rbac@test.com',
        password: 'RbacPass123!',
      });
      testUserId = result.userId;
    });

    // Assign relasi role -> hak akses harus langsung berlaku
    it('should assign roles to user', async () => {
      const rolesRes = await authGet(app, '/api/roles', adminToken).expect(200);
      const staffRole = rolesRes.body.data.find(
        (r: { name: string }) => r.name === 'Staff',
      );

      const res = await authPost(
        app,
        `/api/users/${testUserId}/roles`,
        adminToken,
      )
        .send({ roleIds: [staffRole.id] })
        .expect(201);

      expect(res.body.message).toContain('berhasil');
    });

    // Role dan permission user harus tampil setelah assignment
    it('should get user roles', async () => {
      const res = await authGet(
        app,
        `/api/users/${testUserId}/roles`,
        adminToken,
      ).expect(200);

      expect(res.body.data.userId).toBe(testUserId);
      expect(res.body.data.roles).toBeInstanceOf(Array);
      expect(res.body.data.roles.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.permissions).toBeInstanceOf(Array);
    });

    // Hapus role sesuai aturan bisnis
    it('should remove role from user', async () => {
      const userRoles = await authGet(
        app,
        `/api/users/${testUserId}/roles`,
        adminToken,
      ).expect(200);

      const rolesRes = await authGet(app, '/api/roles', adminToken).expect(200);
      const roleName = userRoles.body.data.roles[0];
      const roleId = rolesRes.body.data.find(
        (role: { id: number; name: string }) => role.name === roleName,
      )?.id;

      expect(roleId).toBeDefined();

      await authDelete(
        app,
        `/api/users/${testUserId}/roles/${roleId}`,
        adminToken,
      ).expect(200);

      const updatedRoles = await authGet(
        app,
        `/api/users/${testUserId}/roles`,
        adminToken,
      ).expect(200);
      expect(updatedRoles.body.data.roles.length).toBe(0);
    });
  });

  // ==================== GUARD TESTS ====================
  describe('Authorization Guards', () => {
    // Proses verifikasi pegawai harus mengubah status dengan benar
    it('should reject user without Admin role accessing pegawai.create', async () => {
      // Register user tanpa role
      const result = await registerAndLogin(app, {
        username: 'norole',
        email: 'norole@test.com',
        password: 'NoRole123!',
      });

      await authPost(app, '/api/pegawai', result.accessToken)
        .send({
          userId: 1,
          nama: 'Test',
          jabatan: 'Staff',
          noHp: '081200001111',
          alamat: 'Test',
        })
        .expect(403);
    });

    // Keputusan verifikasi role harus tercermin di data
    it('should reject user with Staff role accessing admin-only endpoint', async () => {
      const staffResult = await registerAndLogin(app, {
        username: 'staffguard',
        email: 'staffguard@test.com',
        password: 'StaffGuard123!',
      });

      // Assign Staff role
      const rolesRes = await authGet(app, '/api/roles', adminToken).expect(200);
      const staffRole = rolesRes.body.data.find(
        (r: { name: string }) => r.name === 'Staff',
      );
      await authPost(app, `/api/users/${staffResult.userId}/roles`, adminToken)
        .send({ roleIds: [staffRole.id] })
        .expect(201);

      // Re-login to get updated token
      const { accessToken } = await loginAs(
        app,
        'staffguard',
        'StaffGuard123!',
      );

      // Staff cannot access pegawai.create (Admin only)
      await authPost(app, '/api/pegawai', accessToken)
        .send({
          userId: 1,
          nama: 'Test',
          jabatan: 'Staff',
          noHp: '081200001111',
          alamat: 'Test',
        })
        .expect(403);
    });

    it('should allow kasir to access simpanan and pinjaman write endpoints', async () => {
      const kasirResult = await registerAndLogin(app, {
        username: 'kasirguard',
        email: 'kasirguard@test.com',
        password: 'KasirGuard123!',
      });

      const rolesRes = await authGet(app, '/api/roles', adminToken).expect(200);
      const kasirRole = rolesRes.body.data.find(
        (r: { name: string }) => r.name === 'Kasir',
      );

      await authPost(app, `/api/users/${kasirResult.userId}/roles`, adminToken)
        .send({ roleIds: [kasirRole.id] })
        .expect(201);

      const { accessToken } = await loginAs(
        app,
        'kasirguard',
        'KasirGuard123!',
      );

      await authGet(app, '/api/transaksi', accessToken).expect(200);

      // Not forbidden means permission passed; expected domain-level 404/validation due missing entity setup
      await authPost(app, '/api/simpanan/rekening/999999/setoran', accessToken)
        .send({
          nominal: 50000,
          metodePembayaran: 'CASH',
          catatan: 'Uji akses kasir',
        })
        .expect(404);

      await authPost(app, '/api/pinjaman/999999/angsuran', accessToken)
        .send({
          nominal: 50000,
          metodePembayaran: 'CASH',
          catatan: 'Uji akses kasir',
        })
        .expect(404);
    });

    it('should allow pimpinan to verify pinjaman', async () => {
      const pimpinanResult = await registerAndLogin(app, {
        username: 'pimpinanguard',
        email: 'pimpinanguard@test.com',
        password: 'PimpinanGuard123!',
      });

      const rolesRes = await authGet(app, '/api/roles', adminToken).expect(200);
      const pimpinanRole = rolesRes.body.data.find(
        (r: { name: string }) => r.name === 'Pimpinan',
      );

      await authPost(
        app,
        `/api/users/${pimpinanResult.userId}/roles`,
        adminToken,
      )
        .send({ roleIds: [pimpinanRole.id] })
        .expect(201);

      const { accessToken } = await loginAs(
        app,
        'pimpinanguard',
        'PimpinanGuard123!',
      );

      await authGet(app, '/api/pinjaman', accessToken).expect(200);

      // Not forbidden means permission passed; expected 404 because test id doesn't exist
      await authPatch(app, '/api/pinjaman/999999/verifikasi', accessToken)
        .send({ status: 'DISETUJUI', catatan: 'Uji akses pimpinan' })
        .expect(404);
    });
  });

  // ==================== UPDATE USER ====================
  describe('PATCH /api/users/:id', () => {
    // Status user harus bisa diaktifkan dan dinonaktifkan
    it('should deactivate user and prevent login', async () => {
      const result = await registerAndLogin(app, {
        username: 'deactivateuser',
        email: 'deactivate@test.com',
        password: 'Deactivate123!',
      });

      // Admin deactivates user
      await authPatch(app, `/api/users/${result.userId}`, adminToken)
        .send({ isActive: false })
        .expect(200);

      // User should not be able to login
      await request(app.getHttpServer() as App)
        .post('/api/login')
        .send({
          usernameOrEmail: 'deactivateuser',
          password: 'Deactivate123!',
        })
        .expect(401);
    });
  });
});
