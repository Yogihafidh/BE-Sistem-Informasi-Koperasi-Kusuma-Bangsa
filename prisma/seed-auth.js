const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Starting auth seed...');

  try {
    // ALUR 1 BUAT DATA PERMISSION
    console.log('1. Creating permissions...');
    // Daftar permission
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

    // Upsert Data permission (kalau sudah ada jangan diapa apain kalau belum insert)
    for (const permission of permissions) {
      await prisma.permission.upsert({
        where: { code: permission.code },
        update: {},
        create: permission,
      });
    }

    console.log(`Created ${permissions.length} permissions`);

    // ALUR 2 BUAT DATA DEFAULT SETTINGS
    const defaultSettings = [
      {
        key: 'loan.maxTenorMonths',
        value: '24',
        valueType: 'NUMBER',
        description: 'Batas maksimum tenor pinjaman (bulan)',
      },
      {
        key: 'loan.minTenorMonths',
        value: '3',
        valueType: 'NUMBER',
        description: 'Batas minimum tenor pinjaman (bulan)',
      },
      {
        key: 'loan.maxLoanAmount',
        value: '50000000',
        valueType: 'NUMBER',
        description: 'Batas maksimum nominal pinjaman per pengajuan',
      },
      {
        key: 'loan.defaultInterestPercent',
        value: '2.5',
        valueType: 'NUMBER',
        description: 'Bunga pinjaman default dalam persen',
      },
      {
        key: 'loan.autoApprovalLimit',
        value: '3000000',
        valueType: 'NUMBER',
        description: 'Batas nominal pinjaman untuk auto approval',
      },
      {
        key: 'savings.minInitialDeposit',
        value: '50000',
        valueType: 'NUMBER',
        description: 'Setoran awal minimum saat membuka simpanan',
      },
      {
        key: 'savings.minMonthlyDeposit',
        value: '25000',
        valueType: 'NUMBER',
        description: 'Setoran bulanan minimum simpanan wajib',
      },
      {
        key: 'savings.allowWithdrawalIfLoanActive',
        value: 'false',
        valueType: 'BOOLEAN',
        description: 'Izin tarik simpanan saat pinjaman masih aktif',
      },
      {
        key: 'transaction.maxDailyNominal',
        value: '100000000',
        valueType: 'NUMBER',
        description: 'Batas total nominal transaksi harian per anggota',
      },
      {
        key: 'dashboard.trendMonths',
        value: '6',
        valueType: 'NUMBER',
        description: 'Jumlah bulan yang ditampilkan pada tren dashboard',
      },
    ];

    for (const item of defaultSettings) {
      await prisma.setting.upsert({
        where: { key: item.key },
        update: {
          value: item.value,
          valueType: item.valueType,
          description: item.description,
        },
        create: item,
      });
    }

    console.log(`Created ${defaultSettings.length} default settings`);

    // ALUR 3 BUAT DATA ROLE
    console.log('2. Creating roles...');
    const adminRole = await prisma.role.upsert({
      where: { name: 'Admin' },
      update: {},
      create: {
        name: 'Admin',
        description: 'Administrator sistem',
      },
    });

    const superAdminRole = await prisma.role.upsert({
      where: { name: 'Super Admin' },
      update: {},
      create: {
        name: 'Super Admin',
        description: 'Super administrator dengan akses penuh',
      },
    });

    const kasirRole = await prisma.role.upsert({
      where: { name: 'Kasir' },
      update: {},
      create: {
        name: 'Kasir',
        description: 'Kasir yang menangani transaksi harian',
      },
    });

    const staffRole = await prisma.role.upsert({
      where: { name: 'Staff' },
      update: {},
      create: {
        name: 'Staff',
        description: 'Staff koperasi',
      },
    });

    const pimpinanRole = await prisma.role.upsert({
      where: { name: 'Pimpinan' },
      update: {},
      create: {
        name: 'Pimpinan',
        description: 'Pimpinan koperasi',
      },
    });

    console.log('Created roles: Super Admin, Admin, Kasir, Staff, Pimpinan');

    // Load all permissions once
    const allPermissions = await prisma.permission.findMany();

    // ALUR 4 MAPPING PERMISSION TO ROLES
    // 4.1 Super Admin dapat semua permission
    console.log('3.1 Assigning permissions to Super Admin role...');
    await prisma.rolePermission.deleteMany({
      where: { roleId: superAdminRole.id },
    });

    await prisma.rolePermission.createMany({
      data: allPermissions.map((p) => ({
        roleId: superAdminRole.id,
        permissionId: p.id,
      })),
    });
    console.log(`Assigned ${allPermissions.length} permissions to Super Admin`);

    // 4.2 Admin
    console.log('3.2 Assigning permissions to Admin role...');
    const adminPermissionCodes = [
      'role.create',
      'role.read',
      'role.update',
      'role.delete',
      'permission.create',
      'permission.read',
      'permission.delete',
      'user.read',
      'user.update',
      'user.delete',
      'user.create',
      'pegawai.create',
      'pegawai.read',
      'pegawai.update',
      'pegawai.delete',
      'settings.read',
      'settings.update',
      'audit.read',
    ];

    const adminPermissions = await prisma.permission.findMany({
      where: { code: { in: adminPermissionCodes } },
    });

    await prisma.rolePermission.deleteMany({
      where: { roleId: adminRole.id },
    });

    await prisma.rolePermission.createMany({
      data: adminPermissions.map((p) => ({
        roleId: adminRole.id,
        permissionId: p.id,
      })),
    });

    console.log(`Assigned ${adminPermissions.length} permissions to Admin`);

    // 4.3 Kasir
    console.log('3.3 Assigning permissions to Kasir role...');
    const kasirPermissionCodes = [
      'simpanan.setor',
      'simpanan.tarik',
      'pinjaman.cairkan',
      'pinjaman.angsuran',
      'laporan.read',
    ];

    const kasirPermissions = await prisma.permission.findMany({
      where: { code: { in: kasirPermissionCodes } },
    });

    await prisma.rolePermission.deleteMany({
      where: { roleId: kasirRole.id },
    });

    await prisma.rolePermission.createMany({
      data: kasirPermissions.map((p) => ({
        roleId: kasirRole.id,
        permissionId: p.id,
      })),
    });

    console.log(`Assigned ${kasirPermissions.length} permissions to Kasir`);

    // 4.4 Staff
    console.log('3.4 Assigning permissions to Staff role...');
    const staffPermissionCodes = [
      'nasabah.create',
      'nasabah.read',
      'nasabah.update',
      'simpanan.setor',
      'pinjaman.ajukan',
      'pinjaman.angsuran',
    ];

    const staffPermissions = await prisma.permission.findMany({
      where: { code: { in: staffPermissionCodes } },
    });

    await prisma.rolePermission.deleteMany({
      where: { roleId: staffRole.id },
    });

    await prisma.rolePermission.createMany({
      data: staffPermissions.map((p) => ({
        roleId: staffRole.id,
        permissionId: p.id,
      })),
    });

    console.log(`Assigned ${staffPermissions.length} permissions to Staff`);

    // 4.5 Pimpinan
    console.log('3.5 Assigning permissions to Pimpinan role...');
    const pimpinanPermissionCodes = [
      'nasabah.verify',
      'pinjaman.verify',
      'laporan.read',
      'laporan.generate',
      'laporan.finalize',
      'dashboard.read',
    ];

    const pimpinanPermissions = await prisma.permission.findMany({
      where: { code: { in: pimpinanPermissionCodes } },
    });

    await prisma.rolePermission.deleteMany({
      where: { roleId: pimpinanRole.id },
    });

    await prisma.rolePermission.createMany({
      data: pimpinanPermissions.map((p) => ({
        roleId: pimpinanRole.id,
        permissionId: p.id,
      })),
    });

    console.log(
      `Assigned ${pimpinanPermissions.length} permissions to Pimpinan`,
    );

    // ALUR 5 CREATE DEFAULT USERS
    console.log('4. Creating default users for all roles...');

    const defaultUsers = [
      {
        username: 'superadmin',
        email: 'superadmin@koperasi.com',
        password: 'SuperAdmin@123',
        roleId: superAdminRole.id,
        nama: 'Super Admin Koperasi',
        jabatan: 'Super Administrator',
        noHp: '081200000001',
      },
      {
        username: 'admin',
        email: 'admin@koperasi.com',
        password: 'Admin@123',
        roleId: adminRole.id,
        nama: 'Admin Koperasi',
        jabatan: 'Administrator',
        noHp: '081200000000',
      },
      {
        username: 'pimpinan',
        email: 'pimpinan@koperasi.com',
        password: 'Pimpinan@123',
        roleId: pimpinanRole.id,
        nama: 'Pimpinan Koperasi',
        jabatan: 'Pimpinan',
        noHp: '081200000002',
      },
      {
        username: 'staf',
        email: 'staf@koperasi.com',
        password: 'Staf@123',
        roleId: staffRole.id,
        nama: 'Staf Koperasi',
        jabatan: 'Staff',
        noHp: '081200000003',
      },
      {
        username: 'kasir',
        email: 'kasir@koperasi.com',
        password: 'Kasir@123',
        roleId: kasirRole.id,
        nama: 'Kasir Koperasi',
        jabatan: 'Kasir',
        noHp: '081200000004',
      },
    ];

    for (const item of defaultUsers) {
      // ALUR 6 HASH ALL PASSWORD USERS 
      const hashedPassword = await bcrypt.hash(item.password, 10);

      // ALUR 5 CREATE DEFAULT USERS
      const user = await prisma.user.upsert({
        where: { username: item.username },
        update: {
          email: item.email,
          password: hashedPassword,
          isActive: true,
        },
        create: {
          username: item.username,
          email: item.email,
          password: hashedPassword,
          isActive: true,
        },
      });

      // ALUR 7 ASSIGN ROLE TO USER
      await prisma.userRole.deleteMany({
        where: { userId: user.id },
      });

      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: item.roleId,
        },
      });

      // ALUR 8 CREATE PEGAWAI PROFILE UNTUK USER YANG DIBUAT
      await prisma.pegawai.upsert({
        where: { userId: user.id },
        update: {
          nama: item.nama,
          jabatan: item.jabatan,
          noHp: item.noHp,
          alamat: 'Kantor Pusat Koperasi',
          statusAktif: true,
        },
        create: {
          userId: user.id,
          nama: item.nama,
          jabatan: item.jabatan,
          noHp: item.noHp,
          alamat: 'Kantor Pusat Koperasi',
          statusAktif: true,
        },
      });
    }

    console.log('Default users created/updated:');
    for (const item of defaultUsers) {
      console.log(`- Username: ${item.username}`);
      console.log(`  Email: ${item.email}`);
      console.log(`  Password: ${item.password}`);
    }

    console.log('Auth seed completed successfully!');
  } catch (error) {
    console.error('Error seeding data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed();
