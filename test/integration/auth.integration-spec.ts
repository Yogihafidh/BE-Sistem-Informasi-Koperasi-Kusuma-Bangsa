import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
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
} from '../helpers/auth.helper';

describe('Auth Module (Integration)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    await cleanupDatabase(getPrisma());
    await seedDatabase(getPrisma());
    const tokens = await loginAsAdmin(app);
    adminToken = tokens.accessToken;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  // ==================== REGISTER ====================
  describe('POST /api/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app.getHttpServer() as App)
        .post('/api/register')
        .send({
          username: 'testuser1',
          email: 'testuser1@test.com',
          password: 'TestPass123!',
        })
        .expect(201);

      expect(res.body.message).toBe('Registrasi berhasil');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user.username).toBe('testuser1');
      expect(res.body.user.email).toBe('testuser1@test.com');
    });

    it('should reject duplicate username', async () => {
      const res = await request(app.getHttpServer() as App)
        .post('/api/register')
        .send({
          username: 'testuser1',
          email: 'different@test.com',
          password: 'TestPass123!',
        })
        .expect(409);

      expect(res.body.statusCode).toBe(409);
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('path');
    });

    it('should reject duplicate email', async () => {
      const res = await request(app.getHttpServer() as App)
        .post('/api/register')
        .send({
          username: 'uniqueuser',
          email: 'testuser1@test.com',
          password: 'TestPass123!',
        })
        .expect(409);

      expect(res.body.statusCode).toBe(409);
    });

    it('should reject invalid DTO (missing email)', async () => {
      const res = await request(app.getHttpServer() as App)
        .post('/api/register')
        .send({
          username: 'nomail',
          password: 'TestPass123!',
        })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('path');
    });

    it('should reject weak password', async () => {
      const res = await request(app.getHttpServer() as App)
        .post('/api/register')
        .send({
          username: 'weakpass',
          email: 'weak@test.com',
          password: '12345678',
        })
        .expect(400);

      expect(res.body.statusCode).toBe(400);
    });
  });

  // ==================== LOGIN ====================
  describe('POST /api/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app.getHttpServer() as App)
        .post('/api/login')
        .send({
          usernameOrEmail: 'admin',
          password: 'Admin@123',
        })
        .expect(200);

      expect(res.body.message).toBe('Login berhasil');
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.username).toBe('admin');
      expect(typeof res.body.user.pegawaiId).toBe('number');
      expect(res.body.user.roles).toContain('Admin');
    });

    it('should login with email', async () => {
      const res = await request(app.getHttpServer() as App)
        .post('/api/login')
        .send({
          usernameOrEmail: 'admin@koperasi.com',
          password: 'Admin@123',
        })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
    });

    it('should reject wrong password', async () => {
      await request(app.getHttpServer() as App)
        .post('/api/login')
        .send({
          usernameOrEmail: 'admin',
          password: 'WrongPass123!',
        })
        .expect(401);
    });

    it('should reject non-existent user', async () => {
      await request(app.getHttpServer() as App)
        .post('/api/login')
        .send({
          usernameOrEmail: 'nonexistent',
          password: 'SomePass123!',
        })
        .expect(401);
    });
  });

  // ==================== PROFILE ====================
  describe('GET /api/profile', () => {
    it('should return profile with valid token', async () => {
      const res = await authGet(app, '/api/profile', adminToken).expect(200);

      expect(res.body.username).toBe('admin');
      expect(res.body.email).toBe('admin@koperasi.com');
      expect(res.body.roles).toContain('Admin');
      expect(res.body.permissions).toBeUndefined();
      expect(res.body.createdAt).toBeUndefined();
      expect(typeof res.body.pegawaiId).toBe('number');
      expect(res.body.nama).toBeDefined();
      expect(res.body.jabatan).toBeDefined();
      expect(res.body.noHp).toBeDefined();
      expect(res.body.alamat).toBeDefined();
      expect(res.body.isActive).toBe(true);
    });

    it('should reject request without token', async () => {
      await request(app.getHttpServer() as App)
        .get('/api/profile')
        .expect(401);
    });

    it('should reject request with invalid token', async () => {
      await authGet(app, '/api/profile', 'invalid-token-here').expect(401);
    });
  });

  // ==================== CHANGE PASSWORD ====================
  describe('POST /api/change-password', () => {
    let userToken: string;

    beforeAll(async () => {
      await registerUser(app, {
        username: 'changepwuser',
        email: 'changepw@test.com',
        password: 'OldPass123!',
      });
      const tokens = await loginAs(app, 'changepwuser', 'OldPass123!');
      userToken = tokens.accessToken;
    });

    it('should reject wrong old password', async () => {
      await authPost(app, '/api/change-password', userToken)
        .send({
          oldPassword: 'WrongOld123!',
          newPassword: 'NewPass123!',
          confirmPassword: 'NewPass123!',
        })
        .expect(400);
    });

    it('should reject mismatched confirm password', async () => {
      await authPost(app, '/api/change-password', userToken)
        .send({
          oldPassword: 'OldPass123!',
          newPassword: 'NewPass123!',
          confirmPassword: 'Mismatch123!',
        })
        .expect(400);
    });

    it('should change password successfully', async () => {
      const res = await authPost(app, '/api/change-password', userToken)
        .send({
          oldPassword: 'OldPass123!',
          newPassword: 'NewPass123!',
          confirmPassword: 'NewPass123!',
        })
        .expect(200);

      expect(res.body.message).toBe('Password berhasil diubah');

      // Can login with new password
      const tokens = await loginAs(app, 'changepwuser', 'NewPass123!');
      expect(tokens.accessToken).toBeDefined();
    });
  });

  // ==================== REFRESH TOKEN ====================
  describe('POST /api/refresh', () => {
    it('should refresh access token', async () => {
      const tokens = await loginAsAdmin(app);
      const res = await request(app.getHttpServer() as App)
        .post('/api/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);

      expect(res.body.message).toBe('Token berhasil diperbarui');
      expect(res.body.accessToken).toBeDefined();
    });
  });

  // ==================== LOGOUT ====================
  describe('POST /api/logout', () => {
    it('should logout and blacklist token', async () => {
      const tokens = await loginAsAdmin(app);
      const tokenToLogout = tokens.accessToken;

      const res = await authPost(app, '/api/logout', tokenToLogout).expect(200);

      expect(res.body.message).toBe('Logout berhasil');

      // Token should be blacklisted — next request should fail
      await authGet(app, '/api/profile', tokenToLogout).expect(401);
    });
  });
});
