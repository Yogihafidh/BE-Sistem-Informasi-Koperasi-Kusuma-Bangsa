import { INestApplication } from '@nestjs/common';
import { authPost, authPatch, authGet, registerAndLogin } from './auth.helper';

/**
 * Buat user baru + assign role, return token & userId.
 */
export async function createUserWithRole(
  app: INestApplication,
  adminToken: string,
  data: { username: string; email: string; password: string },
  roleIds: number[],
) {
  const result = await registerAndLogin(app, data);

  // Assign roles
  await authPost(app, `/api/users/${result.userId}/roles`, adminToken)
    .send({ roleIds })
    .expect(201);

  return result;
}

/**
 * Buat pegawai dari user yang sudah ada.
 */
export async function createTestPegawai(
  app: INestApplication,
  token: string,
  userId: number,
  overrides: Record<string, unknown> = {},
) {
  const dto = {
    userId,
    nama: `Pegawai Test ${Date.now()}`,
    jabatan: 'Staff',
    noHp: '081200001111',
    alamat: 'Jl. Test No. 1',
    ...overrides,
  };

  const res = await authPost(app, '/api/pegawai', token).send(dto).expect(201);

  return res.body.data;
}

/**
 * Buat nasabah baru (status PENDING).
 */
export async function createTestNasabah(
  app: INestApplication,
  token: string,
  overrides: Record<string, unknown> = {},
) {
  const uniqueSuffix = Date.now().toString().slice(-8);
  const dto = {
    nama: `Nasabah Test ${uniqueSuffix}`,
    nik: `320101${uniqueSuffix}01`,
    alamat: 'Jl. Nasabah Test No. 1',
    noHp: '0812' + uniqueSuffix,
    pekerjaan: 'Wiraswasta',
    penghasilanBulanan: 5000000,
    tanggalLahir: '1995-08-17',
    ...overrides,
  };

  const res = await authPost(app, '/api/nasabah', token).send(dto).expect(201);

  return res.body.data;
}

/**
 * Verifikasi nasabah jadi AKTIF (auto-create 3 rekening).
 */
export async function verifyNasabah(
  app: INestApplication,
  token: string,
  nasabahId: number,
) {
  const res = await authPatch(
    app,
    `/api/nasabah/${nasabahId}/verifikasi`,
    token,
  )
    .send({ status: 'AKTIF', catatan: 'Verified for testing' })
    .expect(200);

  return res.body.data;
}

/**
 * Buat nasabah + verifikasi AKTIF → rekening simpanan otomatis dibuat.
 */
export async function createFullNasabah(
  app: INestApplication,
  token: string,
  overrides: Record<string, unknown> = {},
) {
  const nasabah = await createTestNasabah(app, token, overrides);
  await verifyNasabah(app, token, nasabah.id);

  // Get rekening simpanan
  const rekeningRes = await authGet(
    app,
    `/api/simpanan/nasabah/${nasabah.id}`,
    token,
  ).expect(200);

  return {
    nasabah,
    rekeningList: rekeningRes.body.data as Array<{
      id: number;
      jenisSimpanan: string;
      saldoBerjalan: string;
    }>,
  };
}

/**
 * Buat pinjaman.
 */
export async function createTestPinjaman(
  app: INestApplication,
  token: string,
  nasabahId: number,
  overrides: Record<string, unknown> = {},
) {
  const dto = {
    nasabahId,
    jumlahPinjaman: 2000000,
    tenorBulan: 6,
    ...overrides,
  };

  const res = await authPost(app, '/api/pinjaman', token).send(dto).expect(201);

  return res.body.data;
}
