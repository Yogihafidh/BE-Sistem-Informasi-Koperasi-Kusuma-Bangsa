import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';

let prisma: PrismaClient | undefined;
let cacheClient: Keyv | undefined;

export function getPrisma(): PrismaClient {
  prisma ??= new PrismaClient();
  return prisma;
}

function getCacheClient(): Keyv {
  if (!cacheClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    cacheClient = new Keyv({ store: new KeyvRedis(redisUrl) });
  }

  return cacheClient;
}

async function cleanupCache(): Promise<void> {
  try {
    await getCacheClient().clear();
  } catch {
    // Ignore cache cleanup failure in tests to avoid masking real test assertions.
  }
}

export async function clearTestCache(): Promise<void> {
  await cleanupCache();
}

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaClient)
    .useValue(getPrisma())
    .compile();

  const app = moduleFixture.createNestApplication();

  // Mirror main.ts configuration
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix('api');

  await app.init();
  return app;
}

export async function cleanupDatabase(p?: PrismaClient): Promise<void> {
  const client = p ?? getPrisma();

  await cleanupCache();

  // Truncate all tables in the correct order (respecting FK constraints)
  await client.$executeRawUnsafe(`
    TRUNCATE TABLE 
      "AuditTrail",
      "LaporanKeuangan",
      "Transaksi",
      "RekeningSimpanan",
      "Pinjaman",
      "NasabahDokumen",
      "Nasabah",
      "Pegawai",
      "UserRole",
      "RolePermission",
      "Permission",
      "Role",
      "User",
      "Setting"
    CASCADE;
  `);
}

export async function seedDatabase(p?: PrismaClient): Promise<void> {
  const client = p ?? getPrisma();

  // --------- Permissions ---------
  const permissions = [
    { code: 'user.create', description: 'Create user' },
    { code: 'user.read', description: 'Read user' },
    { code: 'user.update', description: 'Update user' },
    { code: 'user.delete', description: 'Delete user' },
    { code: 'role.create', description: 'Create role' },
    { code: 'role.read', description: 'Read role' },
    { code: 'role.update', description: 'Update role' },
    { code: 'role.delete', description: 'Delete role' },
    { code: 'permission.create', description: 'Create permission' },
    { code: 'permission.read', description: 'Read permission' },
    { code: 'permission.delete', description: 'Delete permission' },
    { code: 'nasabah.create', description: 'Create nasabah' },
    { code: 'nasabah.read', description: 'Read nasabah' },
    { code: 'nasabah.update', description: 'Update nasabah' },
    { code: 'nasabah.verify', description: 'Verify nasabah' },
    { code: 'pegawai.create', description: 'Create pegawai' },
    { code: 'pegawai.read', description: 'Read pegawai' },
    { code: 'pegawai.update', description: 'Update pegawai' },
    { code: 'pegawai.delete', description: 'Delete pegawai' },
    { code: 'simpanan.read', description: 'Read simpanan' },
    { code: 'simpanan.setor', description: 'Setor simpanan' },
    { code: 'simpanan.tarik', description: 'Tarik simpanan' },
    { code: 'pinjaman.ajukan', description: 'Ajukan pinjaman' },
    { code: 'pinjaman.read', description: 'Read pinjaman' },
    { code: 'pinjaman.verify', description: 'Verifikasi pinjaman' },
    { code: 'pinjaman.cairkan', description: 'Pencairan pinjaman' },
    { code: 'pinjaman.angsuran', description: 'Bayar angsuran pinjaman' },
    { code: 'transaksi.read', description: 'Read transaksi' },
    { code: 'transaksi.process', description: 'Process transaksi' },
    { code: 'laporan.read', description: 'Read laporan' },
    { code: 'laporan.generate', description: 'Generate laporan' },
    { code: 'laporan.finalize', description: 'Finalize laporan' },
    { code: 'dashboard.read', description: 'Read dashboard' },
    { code: 'audit.read', description: 'Read audit trail' },
    { code: 'settings.read', description: 'Read settings' },
    { code: 'settings.update', description: 'Update settings' },
  ];

  for (const perm of permissions) {
    await client.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
  }

  // --------- Settings ---------
  const settings = [
    {
      key: 'loan.maxTenorMonths',
      value: '24',
      valueType: 'NUMBER' as const,
      description: 'Max tenor bulan',
    },
    {
      key: 'loan.minTenorMonths',
      value: '3',
      valueType: 'NUMBER' as const,
      description: 'Min tenor bulan',
    },
    {
      key: 'loan.maxLoanAmount',
      value: '50000000',
      valueType: 'NUMBER' as const,
      description: 'Max nominal pinjaman',
    },
    {
      key: 'loan.defaultInterestPercent',
      value: '2.5',
      valueType: 'NUMBER' as const,
      description: 'Bunga default',
    },
    {
      key: 'loan.autoApprovalLimit',
      value: '3000000',
      valueType: 'NUMBER' as const,
      description: 'Auto approval limit',
    },
    {
      key: 'savings.minInitialDeposit',
      value: '50000',
      valueType: 'NUMBER' as const,
      description: 'Min setoran awal',
    },
    {
      key: 'savings.minMonthlyDeposit',
      value: '25000',
      valueType: 'NUMBER' as const,
      description: 'Min setoran bulanan',
    },
    {
      key: 'savings.allowWithdrawalIfLoanActive',
      value: 'false',
      valueType: 'BOOLEAN' as const,
      description: 'Izin tarik saat pinjaman aktif',
    },
    {
      key: 'transaction.maxDailyNominal',
      value: '100000000',
      valueType: 'NUMBER' as const,
      description: 'Max nominal harian',
    },
    {
      key: 'dashboard.trendMonths',
      value: '6',
      valueType: 'NUMBER' as const,
      description: 'Bulan tren dashboard',
    },
  ];

  for (const s of settings) {
    await client.setting.upsert({
      where: { key: s.key },
      update: {
        value: s.value,
        valueType: s.valueType,
        description: s.description,
      },
      create: s,
    });
  }

  // --------- Roles ---------
  const adminRole = await client.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: { name: 'Admin', description: 'Administrator dengan akses penuh' },
  });

  const kasirRole = await client.role.upsert({
    where: { name: 'Kasir' },
    update: {},
    create: { name: 'Kasir', description: 'Kasir transaksi harian' },
  });

  const staffRole = await client.role.upsert({
    where: { name: 'Staff' },
    update: {},
    create: { name: 'Staff', description: 'Staff koperasi' },
  });

  const pimpinanRole = await client.role.upsert({
    where: { name: 'Pimpinan' },
    update: {},
    create: { name: 'Pimpinan', description: 'Pimpinan koperasi' },
  });

  // Admin gets all permissions
  const allPermissions = await client.permission.findMany();
  await client.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
  await client.rolePermission.createMany({
    data: allPermissions.map((p) => ({
      roleId: adminRole.id,
      permissionId: p.id,
    })),
  });

  // Kasir permissions
  const kasirCodes = [
    'nasabah.read',
    'simpanan.read',
    'simpanan.setor',
    'simpanan.tarik',
    'pinjaman.read',
    'pinjaman.cairkan',
    'pinjaman.angsuran',
    'transaksi.read',
    'laporan.read',
    'dashboard.read',
  ];
  const kasirPerms = await client.permission.findMany({
    where: { code: { in: kasirCodes } },
  });
  await client.rolePermission.deleteMany({ where: { roleId: kasirRole.id } });
  await client.rolePermission.createMany({
    data: kasirPerms.map((p) => ({ roleId: kasirRole.id, permissionId: p.id })),
  });

  // Staff permissions
  const staffCodes = [
    'nasabah.create',
    'nasabah.read',
    'nasabah.update',
    'simpanan.setor',
    'pinjaman.ajukan',
    'pinjaman.angsuran',
  ];
  const staffPerms = await client.permission.findMany({
    where: { code: { in: staffCodes } },
  });
  await client.rolePermission.deleteMany({ where: { roleId: staffRole.id } });
  await client.rolePermission.createMany({
    data: staffPerms.map((p) => ({ roleId: staffRole.id, permissionId: p.id })),
  });

  // Pimpinan permissions
  const pimpinanCodes = [
    'nasabah.read',
    'nasabah.verify',
    'simpanan.read',
    'pinjaman.read',
    'pinjaman.verify',
    'transaksi.read',
    'laporan.read',
    'laporan.generate',
    'laporan.finalize',
    'dashboard.read',
    'audit.read',
  ];
  const pimpinanPerms = await client.permission.findMany({
    where: { code: { in: pimpinanCodes } },
  });
  await client.rolePermission.deleteMany({
    where: { roleId: pimpinanRole.id },
  });
  await client.rolePermission.createMany({
    data: pimpinanPerms.map((p) => ({
      roleId: pimpinanRole.id,
      permissionId: p.id,
    })),
  });

  // --------- Admin User ---------
  const hashedPassword = await bcrypt.hash('Admin@123', 10);
  const adminUser = await client.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@koperasi.com',
      password: hashedPassword,
      isActive: true,
    },
  });

  await client.userRole.deleteMany({ where: { userId: adminUser.id } });
  await client.userRole.create({
    data: { userId: adminUser.id, roleId: adminRole.id },
  });

  // --------- Pegawai for Admin (required by NasabahService) ---------
  await client.pegawai.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: {
      userId: adminUser.id,
      nama: 'Admin Koperasi',
      jabatan: 'Administrator',
      noHp: '081200000000',
      alamat: 'Kantor Pusat Koperasi',
      statusAktif: true,
    },
  });
}

export async function closeTestApp(app: INestApplication): Promise<void> {
  await app.close();

  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }

  if (cacheClient) {
    const disconnect = (
      cacheClient as unknown as { disconnect?: () => Promise<void> }
    ).disconnect;
    if (disconnect) {
      await disconnect.call(cacheClient);
    }
    cacheClient = undefined;
  }
}
