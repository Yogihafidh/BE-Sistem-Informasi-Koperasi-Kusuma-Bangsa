import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  cleanupDatabase,
  seedDatabase,
  closeTestApp,
  getPrisma,
} from '../../helpers/test-app.helper';
import {
  loginAsAdmin,
  registerUser,
  authGet,
  authPost,
  authPatch,
} from '../../helpers/auth.helper';
import {
  createTestPegawai,
  createTestNasabah,
  verifyNasabah,
} from '../../helpers/factory.helper';

/**
 * End-to-end business flow:
 * Login → Create Pegawai → Create Nasabah → Verify → Simpanan → Pinjaman → Pencairan → Angsuran → Laporan → Dashboard
 */
describe('Full Koperasi Business Flow (Integration)', () => {
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

  let pegawaiUserId: number;
  let nasabahId: number;
  let rekeningSukarelaId: number;
  let pinjamanId: number;

  it('Step 1: Register a new employee user', async () => {
    const res = await registerUser(app, {
      username: 'karyawan_flow',
      email: 'karyawan_flow@koperasi.com',
      password: 'Karyawan123!',
    });
    expect(res.user).toHaveProperty('id');
    pegawaiUserId = res.user.id;
  });

  it('Step 2: Create pegawai from the user', async () => {
    const pegawai = await createTestPegawai(app, adminToken, pegawaiUserId, {
      nama: 'Karyawan Flow',
      jabatan: 'Kasir',
    });
    expect(pegawai).toHaveProperty('id');
    expect(pegawai.nama).toBe('Karyawan Flow');
  });

  it('Step 3: Assign Kasir role to the employee user', async () => {
    const rolesRes = await authGet(app, '/api/roles', adminToken).expect(200);
    const kasirRole = rolesRes.body.data.find(
      (r: { name: string }) => r.name === 'Kasir',
    );
    expect(kasirRole).toBeDefined();

    await authPost(app, `/api/users/${pegawaiUserId}/roles`, adminToken)
      .send({ roleIds: [kasirRole.id] })
      .expect(201);
  });

  it('Step 4: Create a new nasabah', async () => {
    const nasabah = await createTestNasabah(app, adminToken, {
      nama: 'Budi Nasabah Flow',
      nik: '9999888877776661',
    });
    expect(nasabah).toHaveProperty('id');
    expect(nasabah.status).toBe('PENDING');
    nasabahId = nasabah.id;
  });

  it('Step 5: Verify the nasabah (auto-creates 3 rekening)', async () => {
    const verified = await verifyNasabah(app, adminToken, nasabahId);
    expect(verified.status).toBe('AKTIF');

    const rekeningRes = await authGet(
      app,
      `/api/simpanan/nasabah/${nasabahId}`,
      adminToken,
    ).expect(200);
    expect(rekeningRes.body.data).toHaveLength(3);

    rekeningSukarelaId = rekeningRes.body.data.find(
      (r: { jenisSimpanan: string }) => r.jenisSimpanan === 'SUKARELA',
    )!.id;
  });

  it('Step 6: Deposit (setoran) into SUKARELA rekening', async () => {
    const res = await authPost(
      app,
      `/api/simpanan/rekening/${rekeningSukarelaId}/setoran`,
      adminToken,
    )
      .send({ nominal: 2000000, metodePembayaran: 'CASH' })
      .expect(201);

    expect(res.body.message).toContain('berhasil');
  });

  it('Step 7: Verify saldo increased', async () => {
    const res = await authGet(
      app,
      `/api/simpanan/nasabah/${nasabahId}`,
      adminToken,
    ).expect(200);

    const rekeningSukarela = res.body.data.find(
      (item: { id: number }) => item.id === rekeningSukarelaId,
    );
    expect(rekeningSukarela).toBeDefined();

    const saldo = parseFloat(rekeningSukarela.saldoBerjalan);
    expect(saldo).toBeGreaterThanOrEqual(2000000);
  });

  it('Step 8: Create a pinjaman (≤ 3M for auto-approval)', async () => {
    const res = await authPost(app, '/api/pinjaman', adminToken)
      .send({
        nasabahId,
        jumlahPinjaman: 2000000,
        tenorBulan: 6,
      })
      .expect(201);

    expect(res.body.data).toHaveProperty('id');
    pinjamanId = res.body.data.id;
  });

  it('Step 9: Pencairan pinjaman', async () => {
    const res = await authPost(
      app,
      `/api/pinjaman/${pinjamanId}/pencairan`,
      adminToken,
    )
      .send({ metodePembayaran: 'TRANSFER' })
      .expect(201);

    expect(res.body.message).toContain('berhasil');
  });

  it('Step 10: Pay angsuran', async () => {
    const res = await authPost(
      app,
      `/api/pinjaman/${pinjamanId}/angsuran`,
      adminToken,
    )
      .send({ nominal: 500000, metodePembayaran: 'CASH' })
      .expect(201);

    expect(res.body.message).toContain('berhasil');
  });

  it('Step 11: Check transaksi list has records', async () => {
    const res = await authGet(
      app,
      `/api/transaksi/nasabah/${nasabahId}`,
      adminToken,
    ).expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it('Step 12: Generate laporan keuangan', async () => {
    const bulan = new Date().getMonth() + 1;
    const tahun = new Date().getFullYear();

    const res = await authPost(
      app,
      `/api/laporan/keuangan/generate?bulan=${bulan}&tahun=${tahun}`,
      adminToken,
    ).expect(201);

    expect(res.body.data).toHaveProperty('id');
  });

  it('Step 13: Check dashboard summary', async () => {
    const res = await authGet(app, '/api/dashboard', adminToken).expect(200);

    expect(res.body).toBeDefined();
    expect(res.body.context).toBeDefined();
    expect(res.body.ringkasanUtama).toBeDefined();
    expect(res.body.aktivitasTransaksi).toBeDefined();
    expect(res.body.kreditPinjaman).toBeDefined();
    expect(res.body.keanggotaan).toBeDefined();
    expect(res.body.performance).toBeUndefined();
    expect(res.body.highlight).toBeUndefined();
  });
});
