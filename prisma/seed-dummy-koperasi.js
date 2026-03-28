const {
  PrismaClient,
  JenisSimpanan,
  JenisTransaksi,
  NasabahStatus,
  PinjamanStatus,
  StatusLaporan,
} = require('@prisma/client');

const prisma = new PrismaClient();

function dt(yyyy, mm, dd, hh = 9, mi = 0, ss = 0) {
  return new Date(Date.UTC(yyyy, mm - 1, dd, hh, mi, ss));
}

function toMonthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function ensureUserWithRole({
  username,
  email,
  roleName,
  password = 'Dummy123!',
}) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });

  const user = await prisma.user.upsert({
    where: { username },
    update: {
      email,
      isActive: true,
      password,
    },
    create: {
      username,
      email,
      isActive: true,
      password,
    },
  });

  if (role) {
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
      },
    });
  }

  return user;
}

async function seedDummyKoperasi() {
  console.log('🌱 Seed dummy koperasi dimulai...');

  const pegawaiSpecs = [
    {
      key: 'PGW-001',
      username: 'dummy2026.pimpinan',
      email: 'dummy2026.pimpinan@koperasi.local',
      roleName: 'Pimpinan',
      nama: 'Rudi Hartono',
      jabatan: 'Pimpinan Operasional',
      noHp: '081311110001',
      alamat: 'Jl. Melati No. 11, Bandung',
    },
    {
      key: 'PGW-002',
      username: 'dummy2026.kasir',
      email: 'dummy2026.kasir@koperasi.local',
      roleName: 'Kasir',
      nama: 'Sinta Lestari',
      jabatan: 'Kasir Senior',
      noHp: '081311110002',
      alamat: 'Jl. Anggrek No. 8, Bandung',
    },
    {
      key: 'PGW-003',
      username: 'dummy2026.staff1',
      email: 'dummy2026.staff1@koperasi.local',
      roleName: 'Staff',
      nama: 'Deni Pratama',
      jabatan: 'Staff Keanggotaan',
      noHp: '081311110003',
      alamat: 'Jl. Cendana No. 2, Bandung',
    },
    {
      key: 'PGW-004',
      username: 'dummy2026.staff2',
      email: 'dummy2026.staff2@koperasi.local',
      roleName: 'Staff',
      nama: 'Maya Wulandari',
      jabatan: 'Staff Kredit',
      noHp: '081311110004',
      alamat: 'Jl. Kenanga No. 5, Bandung',
    },
  ];

  const nasabahSpecs = [
    {
      code: 'NB-001',
      nomorAnggota: 'DMY2026-001',
      nama: 'Agus Setiawan',
      nik: '3201012601010001',
      alamat: 'Jl. Sukamaju No. 10, Bandung',
      noHp: '081221110001',
      pekerjaan: 'Wiraswasta',
      instansi: 'Toko Sembako Maju Jaya',
      penghasilanBulanan: '6500000',
      tanggalLahir: dt(1988, 1, 26),
      tanggalDaftar: dt(2025, 10, 10),
      status: NasabahStatus.AKTIF,
    },
    {
      code: 'NB-002',
      nomorAnggota: 'DMY2026-002',
      nama: 'Budi Santoso',
      nik: '3201011203840002',
      alamat: 'Jl. Cipedes No. 14, Bandung',
      noHp: '081221110002',
      pekerjaan: 'Karyawan Swasta',
      instansi: 'PT Sinar Logistik',
      penghasilanBulanan: '5200000',
      tanggalLahir: dt(1984, 3, 12),
      tanggalDaftar: dt(2025, 8, 14),
      status: NasabahStatus.AKTIF,
    },
    {
      code: 'NB-003',
      nomorAnggota: 'DMY2026-003',
      nama: 'Citra Puspita',
      nik: '3201010706900003',
      alamat: 'Jl. Kopo Permai Blok B3',
      noHp: '081221110003',
      pekerjaan: 'Guru',
      instansi: 'SMP Negeri 12 Bandung',
      penghasilanBulanan: '5800000',
      tanggalLahir: dt(1990, 6, 7),
      tanggalDaftar: dt(2025, 9, 4),
      status: NasabahStatus.AKTIF,
    },
    {
      code: 'NB-004',
      nomorAnggota: 'DMY2026-004',
      nama: 'Dewi Kartika',
      nik: '3201012202920004',
      alamat: 'Jl. Arcamanik No. 7, Bandung',
      noHp: '081221110004',
      pekerjaan: 'UMKM Kuliner',
      instansi: 'Dapur Ibu Dewi',
      penghasilanBulanan: '4700000',
      tanggalLahir: dt(1992, 2, 22),
      tanggalDaftar: dt(2025, 11, 2),
      status: NasabahStatus.AKTIF,
    },
    {
      code: 'NB-005',
      nomorAnggota: 'DMY2026-005',
      nama: 'Eko Prabowo',
      nik: '3201011508780005',
      alamat: 'Jl. Soekarno Hatta No. 150, Bandung',
      noHp: '081221110005',
      pekerjaan: 'Driver Online',
      instansi: 'Mitra Transportasi',
      penghasilanBulanan: '4300000',
      tanggalLahir: dt(1978, 8, 15),
      tanggalDaftar: dt(2025, 7, 20),
      status: NasabahStatus.AKTIF,
    },
    {
      code: 'NB-006',
      nomorAnggota: 'DMY2026-006',
      nama: 'Fitri Ananda',
      nik: '3201013004950006',
      alamat: 'Jl. Sarijadi No. 21, Bandung',
      noHp: '081221110006',
      pekerjaan: 'Perawat',
      instansi: 'RS Bhakti Husada',
      penghasilanBulanan: '6100000',
      tanggalLahir: dt(1995, 4, 30),
      tanggalDaftar: dt(2025, 12, 3),
      status: NasabahStatus.AKTIF,
    },
    {
      code: 'NB-007',
      nomorAnggota: 'DMY2026-007',
      nama: 'Gilang Permana',
      nik: '3201011109870007',
      alamat: 'Jl. Batununggal No. 4, Bandung',
      noHp: '081221110007',
      pekerjaan: 'Teknisi',
      instansi: 'CV Teknik Jaya',
      penghasilanBulanan: '4900000',
      tanggalLahir: dt(1987, 9, 11),
      tanggalDaftar: dt(2025, 8, 30),
      status: NasabahStatus.AKTIF,
    },
    {
      code: 'NB-008',
      nomorAnggota: 'DMY2026-008',
      nama: 'Hani Nuraini',
      nik: '3201012703910008',
      alamat: 'Jl. Cibaduyut No. 18, Bandung',
      noHp: '081221110008',
      pekerjaan: 'Penjahit',
      instansi: 'Konveksi Mandiri',
      penghasilanBulanan: '3900000',
      tanggalLahir: dt(1991, 3, 27),
      tanggalDaftar: dt(2025, 11, 18),
      status: NasabahStatus.AKTIF,
    },
    {
      code: 'NB-009',
      nomorAnggota: 'DMY2026-009',
      nama: 'Irwan Kurnia',
      nik: '3201010912850009',
      alamat: 'Jl. Dago Asri No. 9, Bandung',
      noHp: '081221110009',
      pekerjaan: 'Sales',
      instansi: 'PT Prima Distribusi',
      penghasilanBulanan: '5600000',
      tanggalLahir: dt(1985, 12, 9),
      tanggalDaftar: dt(2025, 9, 25),
      status: NasabahStatus.AKTIF,
    },
    {
      code: 'NB-010',
      nomorAnggota: 'DMY2026-010',
      nama: 'Joko Riyadi',
      nik: '3201010507820010',
      alamat: 'Jl. Antapani No. 31, Bandung',
      noHp: '081221110010',
      pekerjaan: 'Karyawan Pabrik',
      instansi: 'PT Tekstil Nusantara',
      penghasilanBulanan: '5100000',
      tanggalLahir: dt(1982, 7, 5),
      tanggalDaftar: dt(2025, 10, 28),
      status: NasabahStatus.AKTIF,
    },
  ];

  const rekeningAwalByNasabah = {
    'NB-001': { POKOK: 500000, WAJIB: 100000, SUKARELA: 400000 },
    'NB-002': { POKOK: 500000, WAJIB: 100000, SUKARELA: 250000 },
    'NB-003': { POKOK: 500000, WAJIB: 125000, SUKARELA: 350000 },
    'NB-004': { POKOK: 500000, WAJIB: 100000, SUKARELA: 200000 },
    'NB-005': { POKOK: 500000, WAJIB: 100000, SUKARELA: 300000 },
    'NB-006': { POKOK: 500000, WAJIB: 150000, SUKARELA: 450000 },
    'NB-007': { POKOK: 500000, WAJIB: 100000, SUKARELA: 280000 },
    'NB-008': { POKOK: 500000, WAJIB: 100000, SUKARELA: 180000 },
    'NB-009': { POKOK: 500000, WAJIB: 125000, SUKARELA: 320000 },
    'NB-010': { POKOK: 500000, WAJIB: 100000, SUKARELA: 260000 },
  };

  const pinjamanSpecs = [
    {
      code: 'PJM-001',
      nasabahCode: 'NB-001',
      jumlahPinjaman: 5000000,
      bungaPersen: '2.5',
      tenorBulan: 12,
      tanggalPersetujuan: dt(2026, 1, 6),
      status: PinjamanStatus.DISETUJUI,
    },
    {
      code: 'PJM-002',
      nasabahCode: 'NB-003',
      jumlahPinjaman: 3000000,
      bungaPersen: '2.0',
      tenorBulan: 10,
      tanggalPersetujuan: dt(2026, 1, 10),
      status: PinjamanStatus.DISETUJUI,
    },
    {
      code: 'PJM-003',
      nasabahCode: 'NB-005',
      jumlahPinjaman: 7000000,
      bungaPersen: '3.0',
      tenorBulan: 18,
      tanggalPersetujuan: dt(2026, 1, 13),
      status: PinjamanStatus.DISETUJUI,
    },
    {
      code: 'PJM-004',
      nasabahCode: 'NB-007',
      jumlahPinjaman: 4000000,
      bungaPersen: '2.2',
      tenorBulan: 8,
      tanggalPersetujuan: dt(2026, 1, 20),
      status: PinjamanStatus.DISETUJUI,
    },
    {
      code: 'PJM-005',
      nasabahCode: 'NB-009',
      jumlahPinjaman: 2500000,
      bungaPersen: '2.4',
      tenorBulan: 6,
      tanggalPersetujuan: dt(2026, 1, 25),
      status: PinjamanStatus.DISETUJUI,
    },
    {
      code: 'PJM-006',
      nasabahCode: 'NB-010',
      jumlahPinjaman: 6000000,
      bungaPersen: '2.7',
      tenorBulan: 12,
      tanggalPersetujuan: dt(2026, 3, 5),
      status: PinjamanStatus.DISETUJUI,
    },
  ];

  const txPlan = [
    // Januari 2026 - aktivitas normal
    {
      d: dt(2026, 1, 3),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-001',
      rekening: JenisSimpanan.WAJIB,
      nominal: 100000,
      catatan: 'Setoran wajib Januari',
    },
    {
      d: dt(2026, 1, 4),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-002',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 250000,
      catatan: 'Setoran sukarela awal bulan',
    },
    {
      d: dt(2026, 1, 5),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-003',
      rekening: JenisSimpanan.WAJIB,
      nominal: 100000,
      catatan: 'Setoran wajib Januari',
    },
    {
      d: dt(2026, 1, 6),
      t: JenisTransaksi.PENCAIRAN,
      nasabah: 'NB-001',
      pinjaman: 'PJM-001',
      nominal: 5000000,
      catatan: 'Pencairan pinjaman modal usaha',
    },
    {
      d: dt(2026, 1, 8),
      t: JenisTransaksi.PENARIKAN,
      nasabah: 'NB-004',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 100000,
      catatan: 'Kebutuhan operasional keluarga',
    },
    {
      d: dt(2026, 1, 10),
      t: JenisTransaksi.PENCAIRAN,
      nasabah: 'NB-003',
      pinjaman: 'PJM-002',
      nominal: 3000000,
      catatan: 'Pencairan biaya pendidikan anak',
    },
    {
      d: dt(2026, 1, 11),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-005',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 150000,
      catatan: 'Setoran pendapatan mingguan',
    },
    {
      d: dt(2026, 1, 12),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-006',
      rekening: JenisSimpanan.WAJIB,
      nominal: 100000,
      catatan: 'Setoran wajib Januari',
    },
    {
      d: dt(2026, 1, 13),
      t: JenisTransaksi.PENCAIRAN,
      nasabah: 'NB-005',
      pinjaman: 'PJM-003',
      nominal: 7000000,
      catatan: 'Pencairan modal renovasi kios',
    },
    {
      d: dt(2026, 1, 15),
      t: JenisTransaksi.PENARIKAN,
      nasabah: 'NB-002',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 120000,
      catatan: 'Tarik dana kebutuhan rumah tangga',
    },
    {
      d: dt(2026, 1, 17),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-007',
      rekening: JenisSimpanan.WAJIB,
      nominal: 100000,
      catatan: 'Setoran wajib Januari',
    },
    {
      d: dt(2026, 1, 20),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-008',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 200000,
      catatan: 'Setoran sukarela',
    },
    {
      d: dt(2026, 1, 21),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-009',
      rekening: JenisSimpanan.WAJIB,
      nominal: 100000,
      catatan: 'Setoran wajib Januari',
    },
    {
      d: dt(2026, 1, 23),
      t: JenisTransaksi.PENARIKAN,
      nasabah: 'NB-008',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 50000,
      catatan: 'Tarik tunai kebutuhan mendadak',
    },
    {
      d: dt(2026, 1, 24),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-010',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 180000,
      catatan: 'Setoran sukarela',
    },
    {
      d: dt(2026, 1, 25),
      t: JenisTransaksi.PENCAIRAN,
      nasabah: 'NB-009',
      pinjaman: 'PJM-005',
      nominal: 2500000,
      catatan: 'Pencairan pinjaman kebutuhan kesehatan',
    },
    {
      d: dt(2026, 1, 26),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-001',
      pinjaman: 'PJM-001',
      nominal: 450000,
      catatan: 'Angsuran pertama pinjaman NB-001',
    },
    {
      d: dt(2026, 1, 27),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-003',
      pinjaman: 'PJM-002',
      nominal: 350000,
      catatan: 'Angsuran pertama pinjaman NB-003',
    },
    {
      d: dt(2026, 1, 28),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-005',
      pinjaman: 'PJM-003',
      nominal: 500000,
      catatan: 'Angsuran pertama pinjaman NB-005',
    },
    {
      d: dt(2026, 1, 30),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-009',
      pinjaman: 'PJM-005',
      nominal: 700000,
      catatan: 'Angsuran pertama pinjaman NB-009',
    },

    // Februari 2026 - aktivitas tinggi
    {
      d: dt(2026, 2, 2),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-001',
      rekening: JenisSimpanan.WAJIB,
      nominal: 100000,
      catatan: 'Setoran wajib Februari',
    },
    {
      d: dt(2026, 2, 2),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-002',
      rekening: JenisSimpanan.WAJIB,
      nominal: 100000,
      catatan: 'Setoran wajib Februari',
    },
    {
      d: dt(2026, 2, 3),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-003',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 300000,
      catatan: 'Setoran sukarela',
    },
    {
      d: dt(2026, 2, 4),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-004',
      rekening: JenisSimpanan.WAJIB,
      nominal: 100000,
      catatan: 'Setoran wajib Februari',
    },
    {
      d: dt(2026, 2, 6),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-004',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 100000,
      catatan: 'Setoran sukarela untuk menjaga likuiditas usaha',
    },
    {
      d: dt(2026, 2, 5),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-005',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 400000,
      catatan: 'Setoran penjualan minggu pertama',
    },
    {
      d: dt(2026, 2, 5),
      t: JenisTransaksi.PENARIKAN,
      nasabah: 'NB-006',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 150000,
      catatan: 'Tarik dana kebutuhan sekolah anak',
    },
    {
      d: dt(2026, 2, 6),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-007',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 220000,
      catatan: 'Setoran sukarela',
    },
    {
      d: dt(2026, 2, 7),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-008',
      rekening: JenisSimpanan.WAJIB,
      nominal: 100000,
      catatan: 'Setoran wajib Februari',
    },
    {
      d: dt(2026, 2, 8),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-009',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 250000,
      catatan: 'Setoran bonus bulanan',
    },
    {
      d: dt(2026, 2, 9),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-010',
      rekening: JenisSimpanan.WAJIB,
      nominal: 100000,
      catatan: 'Setoran wajib Februari',
    },
    {
      d: dt(2026, 2, 10),
      t: JenisTransaksi.PENCAIRAN,
      nasabah: 'NB-007',
      pinjaman: 'PJM-004',
      nominal: 4000000,
      catatan: 'Pencairan pinjaman biaya alat kerja',
    },
    {
      d: dt(2026, 2, 10),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-001',
      pinjaman: 'PJM-001',
      nominal: 500000,
      catatan: 'Angsuran kedua NB-001',
    },
    {
      d: dt(2026, 2, 11),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-003',
      pinjaman: 'PJM-002',
      nominal: 350000,
      catatan: 'Angsuran kedua NB-003',
    },
    {
      d: dt(2026, 2, 12),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-005',
      pinjaman: 'PJM-003',
      nominal: 600000,
      catatan: 'Angsuran kedua NB-005',
    },
    {
      d: dt(2026, 2, 13),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-009',
      pinjaman: 'PJM-005',
      nominal: 800000,
      catatan: 'Angsuran kedua NB-009',
    },
    {
      d: dt(2026, 2, 14),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-006',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 300000,
      catatan: 'Setoran lembur',
    },
    {
      d: dt(2026, 2, 14),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-007',
      pinjaman: 'PJM-004',
      nominal: 500000,
      catatan: 'Angsuran pertama NB-007',
    },
    {
      d: dt(2026, 2, 15),
      t: JenisTransaksi.PENARIKAN,
      nasabah: 'NB-002',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 80000,
      catatan: 'Tarik dana belanja bulanan',
    },
    {
      d: dt(2026, 2, 16),
      t: JenisTransaksi.PENARIKAN,
      nasabah: 'NB-004',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 70000,
      catatan: 'Tarik dana operasional UMKM',
    },
    {
      d: dt(2026, 2, 17),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-001',
      pinjaman: 'PJM-001',
      nominal: 450000,
      catatan: 'Angsuran tambahan NB-001',
    },
    {
      d: dt(2026, 2, 18),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-005',
      pinjaman: 'PJM-003',
      nominal: 550000,
      catatan: 'Angsuran tambahan NB-005',
    },
    {
      d: dt(2026, 2, 19),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-001',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 275000,
      catatan: 'Setoran sukarela',
    },
    {
      d: dt(2026, 2, 19),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-003',
      rekening: JenisSimpanan.WAJIB,
      nominal: 100000,
      catatan: 'Setoran wajib Februari',
    },
    {
      d: dt(2026, 2, 20),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-005',
      rekening: JenisSimpanan.WAJIB,
      nominal: 100000,
      catatan: 'Setoran wajib Februari',
    },
    {
      d: dt(2026, 2, 20),
      t: JenisTransaksi.PENARIKAN,
      nasabah: 'NB-008',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 60000,
      catatan: 'Tarik dana kebutuhan rumah',
    },
    {
      d: dt(2026, 2, 21),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-007',
      rekening: JenisSimpanan.WAJIB,
      nominal: 100000,
      catatan: 'Setoran wajib Februari',
    },
    {
      d: dt(2026, 2, 22),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-009',
      rekening: JenisSimpanan.WAJIB,
      nominal: 100000,
      catatan: 'Setoran wajib Februari',
    },
    {
      d: dt(2026, 2, 23),
      t: JenisTransaksi.PENARIKAN,
      nasabah: 'NB-010',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 90000,
      catatan: 'Tarik dana kebutuhan darurat',
    },
    {
      d: dt(2026, 2, 24),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-003',
      pinjaman: 'PJM-002',
      nominal: 350000,
      catatan: 'Angsuran ketiga NB-003',
    },
    {
      d: dt(2026, 2, 24),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-009',
      pinjaman: 'PJM-005',
      nominal: 1000000,
      catatan: 'Pelunasan NB-009',
    },
    {
      d: dt(2026, 2, 25),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-002',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 200000,
      catatan: 'Setoran sukarela',
    },
    {
      d: dt(2026, 2, 25),
      t: JenisTransaksi.PENARIKAN,
      nasabah: 'NB-006',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 100000,
      catatan: 'Tarik dana transport',
    },
    {
      d: dt(2026, 2, 26),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-007',
      pinjaman: 'PJM-004',
      nominal: 500000,
      catatan: 'Angsuran kedua NB-007',
    },
    {
      d: dt(2026, 2, 27),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-010',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 210000,
      catatan: 'Setoran sukarela',
    },
    {
      d: dt(2026, 2, 28),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-001',
      pinjaman: 'PJM-001',
      nominal: 500000,
      catatan: 'Angsuran ketiga NB-001',
    },

    // Maret 2026 - aktivitas lebih sedikit (edge case)
    {
      d: dt(2026, 3, 2),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-001',
      rekening: JenisSimpanan.WAJIB,
      nominal: 100000,
      catatan: 'Setoran wajib Maret',
    },
    {
      d: dt(2026, 3, 3),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-003',
      rekening: JenisSimpanan.WAJIB,
      nominal: 100000,
      catatan: 'Setoran wajib Maret',
    },
    {
      d: dt(2026, 3, 5),
      t: JenisTransaksi.PENCAIRAN,
      nasabah: 'NB-010',
      pinjaman: 'PJM-006',
      nominal: 6000000,
      catatan: 'Pencairan pinjaman renovasi rumah',
    },
    {
      d: dt(2026, 3, 7),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-001',
      pinjaman: 'PJM-001',
      nominal: 600000,
      catatan: 'Angsuran Maret NB-001',
    },
    {
      d: dt(2026, 3, 8),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-003',
      pinjaman: 'PJM-002',
      nominal: 500000,
      catatan: 'Angsuran Maret NB-003',
    },
    {
      d: dt(2026, 3, 9),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-005',
      pinjaman: 'PJM-003',
      nominal: 700000,
      catatan: 'Angsuran Maret NB-005',
    },
    {
      d: dt(2026, 3, 10),
      t: JenisTransaksi.PENARIKAN,
      nasabah: 'NB-002',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 110000,
      catatan: 'Tarik dana bulanan',
    },
    {
      d: dt(2026, 3, 12),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-007',
      pinjaman: 'PJM-004',
      nominal: 3000000,
      catatan: 'Pelunasan dipercepat NB-007',
    },
    {
      d: dt(2026, 3, 14),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-006',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 180000,
      catatan: 'Setoran sukarela',
    },
    {
      d: dt(2026, 3, 16),
      t: JenisTransaksi.PENARIKAN,
      nasabah: 'NB-008',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 70000,
      catatan: 'Tarik dana kebutuhan keluarga',
    },
    {
      d: dt(2026, 3, 20),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-009',
      rekening: JenisSimpanan.WAJIB,
      nominal: 100000,
      catatan: 'Setoran wajib Maret',
    },
    {
      d: dt(2026, 3, 22),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-010',
      pinjaman: 'PJM-006',
      nominal: 650000,
      catatan: 'Angsuran pertama NB-010',
    },
    {
      d: dt(2026, 3, 24),
      t: JenisTransaksi.PENARIKAN,
      nasabah: 'NB-004',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 50000,
      catatan: 'Tarik dana harian',
    },
    {
      d: dt(2026, 3, 27),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-005',
      rekening: JenisSimpanan.WAJIB,
      nominal: 100000,
      catatan: 'Setoran wajib Maret',
    },
    {
      d: dt(2026, 3, 29),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-010',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 150000,
      catatan: 'Setoran sukarela akhir bulan',
    },
  ];

  // Cleanup data dummy sebelumnya agar idempotent.
  const existingDummy = await prisma.nasabah.findMany({
    where: { nomorAnggota: { startsWith: 'DMY2026-' } },
    select: { id: true },
  });
  const dummyNasabahIds = existingDummy.map((n) => n.id);

  if (dummyNasabahIds.length > 0) {
    await prisma.transaksi.deleteMany({
      where: { nasabahId: { in: dummyNasabahIds } },
    });
    await prisma.rekeningSimpanan.deleteMany({
      where: { nasabahId: { in: dummyNasabahIds } },
    });
    await prisma.pinjaman.deleteMany({
      where: { nasabahId: { in: dummyNasabahIds } },
    });
    await prisma.nasabah.deleteMany({ where: { id: { in: dummyNasabahIds } } });
  }

  await prisma.laporanKeuangan.deleteMany({
    where: {
      periodeTahun: 2026,
      periodeBulan: { in: [1, 2] },
      generatedBy: { username: 'dummy2026.pimpinan' },
    },
  });

  const pegawaiByKey = {};
  for (const spec of pegawaiSpecs) {
    const user = await ensureUserWithRole({
      username: spec.username,
      email: spec.email,
      roleName: spec.roleName,
    });

    const pegawai = await prisma.pegawai.upsert({
      where: { userId: user.id },
      update: {
        nama: spec.nama,
        jabatan: spec.jabatan,
        noHp: spec.noHp,
        alamat: spec.alamat,
        statusAktif: true,
      },
      create: {
        userId: user.id,
        nama: spec.nama,
        jabatan: spec.jabatan,
        noHp: spec.noHp,
        alamat: spec.alamat,
        statusAktif: true,
      },
    });

    pegawaiByKey[spec.key] = pegawai;
  }

  const pegawaiPool = [
    pegawaiByKey['PGW-002'],
    pegawaiByKey['PGW-003'],
    pegawaiByKey['PGW-004'],
  ];

  const nasabahByCode = {};
  for (let i = 0; i < nasabahSpecs.length; i += 1) {
    const spec = nasabahSpecs[i];
    const assignedPegawai = pegawaiPool[i % pegawaiPool.length];

    const nasabah = await prisma.nasabah.create({
      data: {
        pegawaiId: assignedPegawai.id,
        nomorAnggota: spec.nomorAnggota,
        nama: spec.nama,
        nik: spec.nik,
        alamat: spec.alamat,
        noHp: spec.noHp,
        pekerjaan: spec.pekerjaan,
        instansi: spec.instansi,
        penghasilanBulanan: spec.penghasilanBulanan,
        tanggalLahir: spec.tanggalLahir,
        tanggalDaftar: spec.tanggalDaftar,
        status: spec.status,
      },
    });

    nasabahByCode[spec.code] = nasabah;
  }

  const rekeningByNasabahAndJenis = {};
  for (const spec of nasabahSpecs) {
    const nasabah = nasabahByCode[spec.code];
    const saldo = rekeningAwalByNasabah[spec.code];

    rekeningByNasabahAndJenis[spec.code] = {};

    for (const jenis of [
      JenisSimpanan.POKOK,
      JenisSimpanan.WAJIB,
      JenisSimpanan.SUKARELA,
    ]) {
      const rek = await prisma.rekeningSimpanan.create({
        data: {
          nasabahId: nasabah.id,
          jenisSimpanan: jenis,
          saldoBerjalan: String(saldo[jenis]),
          createdAt: dt(2025, 12, 31, 8),
        },
      });

      rekeningByNasabahAndJenis[spec.code][jenis] = rek;
    }
  }

  const pinjamanByCode = {};
  for (const spec of pinjamanSpecs) {
    const nasabah = nasabahByCode[spec.nasabahCode];
    const verifikator = pegawaiByKey['PGW-001'];

    const loan = await prisma.pinjaman.create({
      data: {
        nasabahId: nasabah.id,
        jumlahPinjaman: String(spec.jumlahPinjaman),
        bungaPersen: spec.bungaPersen,
        tenorBulan: spec.tenorBulan,
        sisaPinjaman: String(spec.jumlahPinjaman),
        status: spec.status,
        verifiedById: verifikator.id,
        tanggalPersetujuan: spec.tanggalPersetujuan,
      },
    });

    pinjamanByCode[spec.code] = loan;
  }

  const kasirPegawai = pegawaiByKey['PGW-002'];
  const monthTotals = {
    '2026-01': {
      totalSimpanan: 0,
      totalPenarikan: 0,
      totalPinjaman: 0,
      totalAngsuran: 0,
    },
    '2026-02': {
      totalSimpanan: 0,
      totalPenarikan: 0,
      totalPinjaman: 0,
      totalAngsuran: 0,
    },
    '2026-03': {
      totalSimpanan: 0,
      totalPenarikan: 0,
      totalPinjaman: 0,
      totalAngsuran: 0,
    },
  };

  for (const tx of txPlan) {
    const nasabah = nasabahByCode[tx.nasabah];
    const monthKey = toMonthKey(tx.d);

    if (tx.t === JenisTransaksi.SETORAN || tx.t === JenisTransaksi.PENARIKAN) {
      const rekening = rekeningByNasabahAndJenis[tx.nasabah][tx.rekening];

      const beforeSaldo = Number(rekening.saldoBerjalan);
      const afterSaldo =
        tx.t === JenisTransaksi.SETORAN
          ? beforeSaldo + tx.nominal
          : beforeSaldo - tx.nominal;

      if (afterSaldo < 0) {
        throw new Error(
          `Saldo negatif terdeteksi untuk ${tx.nasabah} rekening ${tx.rekening} pada ${tx.d.toISOString()}`,
        );
      }

      await prisma.transaksi.create({
        data: {
          nasabahId: nasabah.id,
          pegawaiId: kasirPegawai.id,
          rekeningSimpananId: rekening.id,
          jenisTransaksi: tx.t,
          nominal: String(tx.nominal),
          tanggal: tx.d,
          metodePembayaran: 'CASH',
          catatan: tx.catatan,
        },
      });

      const updatedRekening = await prisma.rekeningSimpanan.update({
        where: { id: rekening.id },
        data: { saldoBerjalan: String(afterSaldo) },
      });

      rekeningByNasabahAndJenis[tx.nasabah][tx.rekening] = updatedRekening;

      if (tx.t === JenisTransaksi.SETORAN) {
        monthTotals[monthKey].totalSimpanan += tx.nominal;
      } else {
        monthTotals[monthKey].totalPenarikan += tx.nominal;
      }
    }

    if (tx.t === JenisTransaksi.PENCAIRAN || tx.t === JenisTransaksi.ANGSURAN) {
      const pinjaman = pinjamanByCode[tx.pinjaman];

      let nextSisa = Number(pinjaman.sisaPinjaman);
      let nextStatus = pinjaman.status;

      if (tx.t === JenisTransaksi.ANGSURAN) {
        nextSisa -= tx.nominal;

        if (nextSisa < 0) {
          throw new Error(
            `Angsuran melebihi sisa pinjaman untuk ${tx.pinjaman} pada ${tx.d.toISOString()}`,
          );
        }

        if (nextSisa === 0) {
          nextStatus = PinjamanStatus.LUNAS;
        }
      }

      await prisma.transaksi.create({
        data: {
          nasabahId: nasabah.id,
          pegawaiId: kasirPegawai.id,
          pinjamanId: pinjaman.id,
          jenisTransaksi: tx.t,
          nominal: String(tx.nominal),
          tanggal: tx.d,
          metodePembayaran: 'TRANSFER',
          catatan: tx.catatan,
        },
      });

      if (tx.t === JenisTransaksi.ANGSURAN) {
        const updatedPinjaman = await prisma.pinjaman.update({
          where: { id: pinjaman.id },
          data: {
            sisaPinjaman: String(nextSisa),
            status: nextStatus,
          },
        });

        pinjamanByCode[tx.pinjaman] = updatedPinjaman;
      }

      if (tx.t === JenisTransaksi.PENCAIRAN) {
        monthTotals[monthKey].totalPinjaman += tx.nominal;
      } else {
        monthTotals[monthKey].totalAngsuran += tx.nominal;
      }
    }
  }

  // Skenario edge case: nasabah aktif menjadi nonaktif di bulan Maret.
  await prisma.nasabah.update({
    where: { id: nasabahByCode['NB-008'].id },
    data: {
      status: NasabahStatus.NONAKTIF,
      catatan:
        'Dinonaktifkan pada Maret 2026 karena mengundurkan diri dari keanggotaan.',
    },
  });

  // Skenario edge case: rekening tidak aktif (soft delete) di bulan Maret.
  await prisma.rekeningSimpanan.update({
    where: {
      id: rekeningByNasabahAndJenis['NB-004'][JenisSimpanan.SUKARELA].id,
    },
    data: {
      deletedAt: dt(2026, 3, 18, 10),
    },
  });

  // Pastikan pinjaman aktif -> lunas terjadi di bulan Maret untuk NB-007.
  const pinjaman004 = await prisma.pinjaman.findUnique({
    where: { id: pinjamanByCode['PJM-004'].id },
  });
  if (
    Number(pinjaman004.sisaPinjaman) === 0 &&
    pinjaman004.status !== PinjamanStatus.LUNAS
  ) {
    await prisma.pinjaman.update({
      where: { id: pinjaman004.id },
      data: { status: PinjamanStatus.LUNAS },
    });
  }

  const generatedBy = await prisma.user.findUnique({
    where: { username: 'dummy2026.pimpinan' },
  });
  if (!generatedBy) {
    throw new Error(
      'User dummy2026.pimpinan tidak ditemukan untuk generatedBy laporan.',
    );
  }

  const jan = monthTotals['2026-01'];
  const feb = monthTotals['2026-02'];

  const saldoAwalJan = 0;
  const saldoAkhirJan =
    saldoAwalJan +
    jan.totalSimpanan +
    jan.totalAngsuran -
    jan.totalPenarikan -
    jan.totalPinjaman;
  const saldoAwalFeb = saldoAkhirJan;
  const saldoAkhirFeb =
    saldoAwalFeb +
    feb.totalSimpanan +
    feb.totalAngsuran -
    feb.totalPenarikan -
    feb.totalPinjaman;

  await prisma.laporanKeuangan.create({
    data: {
      periodeBulan: 1,
      periodeTahun: 2026,
      totalSimpanan: String(jan.totalSimpanan),
      totalPenarikan: String(jan.totalPenarikan),
      totalPinjaman: String(jan.totalPinjaman),
      totalAngsuran: String(jan.totalAngsuran),
      saldoAkhir: String(saldoAkhirJan),
      statusLaporan: StatusLaporan.FINAL,
      generatedById: generatedBy.id,
      generatedAt: dt(2026, 2, 1, 9, 30),
    },
  });

  await prisma.laporanKeuangan.create({
    data: {
      periodeBulan: 2,
      periodeTahun: 2026,
      totalSimpanan: String(feb.totalSimpanan),
      totalPenarikan: String(feb.totalPenarikan),
      totalPinjaman: String(feb.totalPinjaman),
      totalAngsuran: String(feb.totalAngsuran),
      saldoAkhir: String(saldoAkhirFeb),
      statusLaporan: StatusLaporan.DRAFT,
      generatedById: generatedBy.id,
      generatedAt: dt(2026, 3, 1, 9, 30),
    },
  });

  const totalTransaksi = await prisma.transaksi.count({
    where: {
      tanggal: {
        gte: dt(2026, 1, 1, 0, 0, 0),
        lt: dt(2026, 4, 1, 0, 0, 0),
      },
      nasabah: {
        nomorAnggota: { startsWith: 'DMY2026-' },
      },
    },
  });

  const totalNasabah = await prisma.nasabah.count({
    where: { nomorAnggota: { startsWith: 'DMY2026-' } },
  });

  console.log('✅ Seed dummy koperasi selesai.');
  console.log(`- Nasabah dummy: ${totalNasabah}`);
  console.log(`- Pegawai dummy: ${pegawaiSpecs.length}`);
  console.log(`- Transaksi Jan-Mar 2026: ${totalTransaksi}`);
  console.log(
    `- Snapshot Jan 2026 (FINAL): saldoAwal=${saldoAwalJan}, saldoAkhir=${saldoAkhirJan}`,
  );
  console.log(
    `- Snapshot Feb 2026 (DRAFT): saldoAwal=${saldoAwalFeb}, saldoAkhir=${saldoAkhirFeb}`,
  );
  console.log(
    '- Catatan: tabel LaporanKeuangan tidak memiliki kolom saldoAwal, sehingga saldoAwal dihitung saat seed dan dicetak di log.',
  );
}

seedDummyKoperasi()
  .catch((error) => {
    console.error('❌ Seed dummy koperasi gagal:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
