import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export async function loginAsAdmin(app: INestApplication): Promise<AuthTokens> {
  return loginAs(app, 'admin', 'Admin@123');
}

export async function loginAs(
  app: INestApplication,
  usernameOrEmail: string,
  password: string,
): Promise<AuthTokens> {
  const res = await request(app.getHttpServer() as App)
    .post('/api/login')
    .send({ usernameOrEmail, password })
    .expect(200);

  return {
    accessToken: res.body.accessToken as string,
    refreshToken: res.body.refreshToken as string,
  };
}

export async function registerUser(
  app: INestApplication,
  data: { username: string; email: string; password: string },
) {
  const res = await request(app.getHttpServer() as App)
    .post('/api/register')
    .send(data)
    .expect(201);

  return res.body;
}

export async function registerAndLogin(
  app: INestApplication,
  data: { username: string; email: string; password: string },
): Promise<AuthTokens & { userId: number }> {
  const registerRes = await registerUser(app, data);
  const tokens = await loginAs(app, data.username, data.password);
  return { ...tokens, userId: registerRes.user.id as number };
}

export function authGet(app: INestApplication, url: string, token: string) {
  return request(app.getHttpServer() as App)
    .get(url)
    .set('Authorization', `Bearer ${token}`);
}

export function authPost(app: INestApplication, url: string, token: string) {
  return request(app.getHttpServer() as App)
    .post(url)
    .set('Authorization', `Bearer ${token}`);
}

export function authPatch(app: INestApplication, url: string, token: string) {
  return request(app.getHttpServer() as App)
    .patch(url)
    .set('Authorization', `Bearer ${token}`);
}

export function authPut(app: INestApplication, url: string, token: string) {
  return request(app.getHttpServer() as App)
    .put(url)
    .set('Authorization', `Bearer ${token}`);
}

export function authDelete(app: INestApplication, url: string, token: string) {
  return request(app.getHttpServer() as App)
    .delete(url)
    .set('Authorization', `Bearer ${token}`);
}
