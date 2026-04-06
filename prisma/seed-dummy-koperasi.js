const {
  PrismaClient,
  JenisSimpanan,
  JenisTransaksi,
  NasabahStatus,
  PinjamanStatus,
  StatusLaporan,
} = require('@prisma/client');

const prisma = new PrismaClient();
const DUMMY_MARKER = 'SEED_DUMMY_BANYUMAS_2026';

function dt(yyyy, mm, dd, hh = 9, mi = 0, ss = 0) {
  return new Date(Date.UTC(yyyy, mm - 1, dd, hh, mi, ss));
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function ensureUserWithRole({ username, email, roleName }) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });

  const user = await prisma.user.upsert({
    where: { username },
    update: {
      email,
      isActive: true,
      password: 'Dummy123!',
    },
    create: {
      username,
      email,
      isActive: true,
      password: 'Dummy123!',
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

async function seedDummyKoperasiBanyumas() {
  console.log('🌱 Seed dummy koperasi Banyumas dimulai...');

  const pegawaiSpecs = [
    {
      key: 'PGW-001',
      username: 'dummy2026.pimpinan',
      email: 'dummy2026.pimpinan@koperasi.local',
      roleName: 'Pimpinan',
      nama: 'Bambang Sudiro',
      jabatan: 'Pimpinan',
      noHp: '081329000111',
      alamat: 'kec.Ajibarang, desa Ajibarang Wetan, rt 2 rw 1',
      statusAktif: true,
    },
    {
      key: 'PGW-002',
      username: 'dummy2026.mantri-lapangan',
      email: 'dummy2026.mantri-lapangan@koperasi.local',
      roleName: 'Staff',
      nama: 'Eko Prasetyo',
      jabatan: 'Mantri Lapangan',
      noHp: '081329000112',
      alamat: 'kec.Gumelar, desa Paningkaban, rt 3 rw 2',
      statusAktif: true,
    },
    {
      key: 'PGW-003',
      username: 'dummy2026.mantri-koordinasi',
      email: 'dummy2026.mantri-koordinasi@koperasi.local',
      roleName: 'Staff',
      nama: 'Siti Rahmawati',
      jabatan: 'Mantri Koordinasi',
      noHp: '081329000113',
      alamat: 'kec.Gumelar, desa Kedungurang, rt 4 rw 2',
      statusAktif: true,
    },
    {
      key: 'PGW-004',
      username: 'dummy2026.kasir-kantor1',
      email: 'dummy2026.kasir-kantor1@koperasi.local',
      roleName: 'Kasir',
      nama: 'Dwi Handayani',
      jabatan: 'Kasir Kantor 1',
      noHp: '081329000114',
      alamat: 'kec.Ajibarang, desa Kracak, rt 1 rw 4',
      statusAktif: true,
    },
    {
      key: 'PGW-005',
      username: 'dummy2026.kasir-kantor2',
      email: 'dummy2026.kasir-kantor2@koperasi.local',
      roleName: 'Kasir',
      nama: 'Rina Kurniasih',
      jabatan: 'Kasir Kantor 2',
      noHp: '081329000115',
      alamat: 'kec.Ajibarang, desa Pancasan, rt 5 rw 3',
      statusAktif: true,
    },
    {
      key: 'PGW-006',
      username: 'dummy2026.it-support',
      email: 'dummy2026.it-support@koperasi.local',
      roleName: 'Staff',
      nama: 'Yusuf Maulana',
      jabatan: 'IT Support',
      noHp: '081329000116',
      alamat: 'kec.Gumelar, desa Cilangkap, rt 2 rw 5',
      statusAktif: false,
    },
  ];

  const nasabahSpecs = [
    {
      code: 'NB-001',
      nomorAnggota: 'AGT-20260105-1201',
      nama: 'Slamet Riyadi',
      nik: '3302041202860001',
      alamat: 'kec.Gumelar, desa Gumelar, rt 2 rw 3',
      noHp: '082145001101',
      pekerjaan: 'Petani',
      penghasilanBulanan: '2600000',
      tanggalLahir: dt(1986, 2, 12),
      tanggalDaftar: dt(2026, 1, 5),
      status: NasabahStatus.AKTIF,
      pegawaiKey: 'PGW-002',
    },
    {
      code: 'NB-002',
      nomorAnggota: 'AGT-20260110-2384',
      nama: 'Yunus Hidayat',
      nik: '3302042307880002',
      alamat: 'kec.Gumelar, desa Samudra, rt 4 rw 2',
      noHp: '082145001102',
      pekerjaan: 'Peternak',
      penghasilanBulanan: '3100000',
      tanggalLahir: dt(1988, 7, 23),
      tanggalDaftar: dt(2026, 1, 10),
      status: NasabahStatus.AKTIF,
      pegawaiKey: 'PGW-002',
    },
    {
      code: 'NB-003',
      nomorAnggota: 'AGT-20260118-3471',
      nama: 'Fuad Kurniawan',
      nik: '3302041509900003',
      alamat: 'kec.Gumelar, desa Cihonje, rt 1 rw 1',
      noHp: '082145001103',
      pekerjaan: 'Wirausaha',
      penghasilanBulanan: '5200000',
      tanggalLahir: dt(1990, 9, 15),
      tanggalDaftar: dt(2026, 1, 18),
      status: NasabahStatus.AKTIF,
      pegawaiKey: 'PGW-003',
    },
    {
      code: 'NB-004',
      nomorAnggota: 'AGT-20260126-4158',
      nama: 'Tarman Setyoko',
      nik: '3302040405920004',
      alamat: 'kec.Gumelar, desa Tlaga, rt 6 rw 2',
      noHp: '082145001104',
      pekerjaan: 'Karyawan Kantoran',
      penghasilanBulanan: '4700000',
      tanggalLahir: dt(1992, 5, 4),
      tanggalDaftar: dt(2026, 1, 26),
      status: NasabahStatus.AKTIF,
      pegawaiKey: 'PGW-003',
    },
    {
      code: 'NB-005',
      nomorAnggota: 'AGT-20260203-5262',
      nama: 'Sudrajat Wibowo',
      nik: '3302041111830005',
      alamat: 'kec.Gumelar, desa Karangkemojing, rt 3 rw 7',
      noHp: '082145001105',
      pekerjaan: 'Petani',
      penghasilanBulanan: '2200000',
      tanggalLahir: dt(1983, 11, 11),
      tanggalDaftar: dt(2026, 2, 3),
      status: NasabahStatus.AKTIF,
      pegawaiKey: 'PGW-002',
    },
    {
      code: 'NB-006',
      nomorAnggota: 'AGT-20260209-6340',
      nama: 'Trenggono Prabawa',
      nik: '3302041708840006',
      alamat: 'kec.Gumelar, desa Gancang, rt 5 rw 6',
      noHp: '082145001106',
      pekerjaan: 'Peternak',
      penghasilanBulanan: '3900000',
      tanggalLahir: dt(1984, 8, 17),
      tanggalDaftar: dt(2026, 2, 9),
      status: NasabahStatus.NONAKTIF,
      pegawaiKey: 'PGW-003',
    },
    {
      code: 'NB-007',
      nomorAnggota: 'AGT-20260214-7425',
      nama: 'Kirman Saputra',
      nik: '3302040201910007',
      alamat: 'kec.Ajibarang, desa Ajibarang Kulon, rt 2 rw 4',
      noHp: '082145001107',
      pekerjaan: 'Wirausaha',
      penghasilanBulanan: '6800000',
      tanggalLahir: dt(1991, 1, 2),
      tanggalDaftar: dt(2026, 2, 14),
      status: NasabahStatus.AKTIF,
      pegawaiKey: 'PGW-002',
    },
    {
      code: 'NB-008',
      nomorAnggota: 'AGT-20260221-8533',
      nama: 'Saiful Anwar',
      nik: '3302042803930008',
      alamat: 'kec.Ajibarang, desa Pancurendang, rt 4 rw 5',
      noHp: '082145001108',
      pekerjaan: 'Karyawan Kantoran',
      penghasilanBulanan: '4500000',
      tanggalLahir: dt(1993, 3, 28),
      tanggalDaftar: dt(2026, 2, 21),
      status: NasabahStatus.AKTIF,
      pegawaiKey: 'PGW-003',
    },
    {
      code: 'NB-009',
      nomorAnggota: 'AGT-20260302-9617',
      nama: 'Basri Firmansyah',
      nik: '3302041905980009',
      alamat: 'kec.Ajibarang, desa Tipar Kidul, rt 8 rw 6',
      noHp: '082145001109',
      pekerjaan: 'Wirausaha',
      penghasilanBulanan: '9200000',
      tanggalLahir: dt(1998, 5, 19),
      tanggalDaftar: dt(2026, 3, 2),
      status: NasabahStatus.AKTIF,
      pegawaiKey: 'PGW-002',
    },
    {
      code: 'NB-010',
      nomorAnggota: 'AGT-20260312-1094',
      nama: 'Tukiman Darsono',
      nik: '3302040906800010',
      alamat: 'kec.Ajibarang, desa Pandansari, rt 7 rw 2',
      noHp: '082145001110',
      pekerjaan: 'Petani',
      penghasilanBulanan: '1800000',
      tanggalLahir: dt(1980, 6, 9),
      tanggalDaftar: dt(2026, 3, 12),
      status: NasabahStatus.NONAKTIF,
      pegawaiKey: 'PGW-003',
    },
  ];

  const rekeningAwal = {
    'NB-001': { POKOK: 500000, WAJIB: 200000, SUKARELA: 900000 },
    'NB-002': { POKOK: 500000, WAJIB: 250000, SUKARELA: 750000 },
    'NB-003': { POKOK: 500000, WAJIB: 250000, SUKARELA: 1300000 },
    'NB-004': { POKOK: 500000, WAJIB: 200000, SUKARELA: 650000 },
    'NB-005': { POKOK: 500000, WAJIB: 150000, SUKARELA: 600000 },
    'NB-006': { POKOK: 500000, WAJIB: 150000, SUKARELA: 500000 },
    'NB-007': { POKOK: 500000, WAJIB: 250000, SUKARELA: 1400000 },
    'NB-008': { POKOK: 500000, WAJIB: 200000, SUKARELA: 850000 },
    'NB-009': { POKOK: 500000, WAJIB: 300000, SUKARELA: 1800000 },
    'NB-010': { POKOK: 500000, WAJIB: 150000, SUKARELA: 550000 },
  };

  const pinjamanSpecs = [
    {
      code: 'PJM-001',
      nasabahCode: 'NB-001',
      jumlahPinjaman: 3000000,
      bungaPersen: '2.5',
      tenorBulan: 12,
      tanggalPersetujuan: dt(2026, 1, 12),
    },
    {
      code: 'PJM-002',
      nasabahCode: 'NB-003',
      jumlahPinjaman: 3500000,
      bungaPersen: '2.8',
      tenorBulan: 18,
      tanggalPersetujuan: dt(2026, 1, 24),
    },
    {
      code: 'PJM-003',
      nasabahCode: 'NB-007',
      jumlahPinjaman: 3000000,
      bungaPersen: '2.2',
      tenorBulan: 10,
      tanggalPersetujuan: dt(2026, 2, 2),
    },
    {
      code: 'PJM-004',
      nasabahCode: 'NB-009',
      jumlahPinjaman: 5000000,
      bungaPersen: '3.0',
      tenorBulan: 24,
      tanggalPersetujuan: dt(2026, 2, 12),
    },
  ];

  const txPlan = [
    // Januari (25 transaksi)
    {
      d: dt(2026, 1, 3),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-001',
      rekening: JenisSimpanan.WAJIB,
      nominal: 250000,
      catatan: 'Setoran wajib awal tahun',
    },
    {
      d: dt(2026, 1, 4),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-002',
      rekening: JenisSimpanan.WAJIB,
      nominal: 250000,
      catatan: 'Setoran wajib Januari',
    },
    {
      d: dt(2026, 1, 5),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-003',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 600000,
      catatan: 'Setoran hasil usaha warung',
    },
    {
      d: dt(2026, 1, 5),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-004',
      rekening: JenisSimpanan.WAJIB,
      nominal: 150000,
      catatan: 'Setoran wajib Januari',
    },
    {
      d: dt(2026, 1, 6),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-005',
      rekening: JenisSimpanan.WAJIB,
      nominal: 150000,
      catatan: 'Setoran wajib Januari',
    },
    {
      d: dt(2026, 1, 7),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-006',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 350000,
      catatan: 'Setoran sukarela bulanan',
    },
    {
      d: dt(2026, 1, 8),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-007',
      rekening: JenisSimpanan.WAJIB,
      nominal: 200000,
      catatan: 'Setoran wajib Januari',
    },
    {
      d: dt(2026, 1, 8),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-008',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 550000,
      catatan: 'Setoran dari gaji bulanan',
    },
    {
      d: dt(2026, 1, 9),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-009',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 700000,
      catatan: 'Setoran laba usaha minggu pertama',
    },
    {
      d: dt(2026, 1, 10),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-010',
      rekening: JenisSimpanan.WAJIB,
      nominal: 180000,
      catatan: 'Setoran wajib Januari',
    },

    {
      d: dt(2026, 1, 12),
      t: JenisTransaksi.PENCAIRAN,
      nasabah: 'NB-001',
      pinjaman: 'PJM-001',
      nominal: 3000000,
      catatan: 'Pencairan modal tanam jagung',
    },
    {
      d: dt(2026, 1, 13),
      t: JenisTransaksi.PENARIKAN,
      nasabah: 'NB-002',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 250000,
      catatan: 'Kebutuhan pakan ternak',
    },
    {
      d: dt(2026, 1, 14),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-004',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 400000,
      catatan: 'Setoran tambahan tengah bulan',
    },
    {
      d: dt(2026, 1, 16),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-005',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 450000,
      catatan: 'Setoran hasil panen singkong',
    },
    {
      d: dt(2026, 1, 17),
      t: JenisTransaksi.PENARIKAN,
      nasabah: 'NB-008',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 200000,
      catatan: 'Biaya sekolah anak',
    },
    {
      d: dt(2026, 1, 20),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-009',
      rekening: JenisSimpanan.WAJIB,
      nominal: 200000,
      catatan: 'Setoran wajib Januari',
    },
    {
      d: dt(2026, 1, 22),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-010',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 350000,
      catatan: 'Setoran sukarela akhir pekan',
    },

    {
      d: dt(2026, 1, 24),
      t: JenisTransaksi.PENCAIRAN,
      nasabah: 'NB-003',
      pinjaman: 'PJM-002',
      nominal: 3500000,
      catatan: 'Pencairan pengembangan bengkel',
    },
    {
      d: dt(2026, 1, 25),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-001',
      pinjaman: 'PJM-001',
      nominal: 650000,
      catatan: 'Angsuran pertama NB-001',
    },
    {
      d: dt(2026, 1, 26),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-002',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 420000,
      catatan: 'Setoran sukarela dari penjualan kambing',
    },
    {
      d: dt(2026, 1, 27),
      t: JenisTransaksi.PENARIKAN,
      nasabah: 'NB-004',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 130000,
      catatan: 'Biaya transport kerja',
    },
    {
      d: dt(2026, 1, 28),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-003',
      pinjaman: 'PJM-002',
      nominal: 850000,
      catatan: 'Angsuran pertama NB-003',
    },
    {
      d: dt(2026, 1, 29),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-007',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 500000,
      catatan: 'Setoran omzet toko',
    },
    {
      d: dt(2026, 1, 30),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-008',
      rekening: JenisSimpanan.WAJIB,
      nominal: 180000,
      catatan: 'Setoran wajib Januari',
    },
    {
      d: dt(2026, 1, 31),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-006',
      rekening: JenisSimpanan.WAJIB,
      nominal: 180000,
      catatan: 'Setoran wajib Januari',
    },

    // Februari (24 transaksi)
    {
      d: dt(2026, 2, 1),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-001',
      rekening: JenisSimpanan.WAJIB,
      nominal: 220000,
      catatan: 'Setoran wajib Februari',
    },
    {
      d: dt(2026, 2, 2),
      t: JenisTransaksi.PENCAIRAN,
      nasabah: 'NB-007',
      pinjaman: 'PJM-003',
      nominal: 3000000,
      catatan: 'Pencairan pinjaman tambahan stok toko',
    },
    {
      d: dt(2026, 2, 3),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-002',
      rekening: JenisSimpanan.WAJIB,
      nominal: 250000,
      catatan: 'Setoran wajib Februari',
    },
    {
      d: dt(2026, 2, 4),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-003',
      rekening: JenisSimpanan.WAJIB,
      nominal: 250000,
      catatan: 'Setoran wajib Februari',
    },
    {
      d: dt(2026, 2, 5),
      t: JenisTransaksi.PENARIKAN,
      nasabah: 'NB-005',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 180000,
      catatan: 'Biaya pupuk kebun',
    },
    {
      d: dt(2026, 2, 6),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-004',
      rekening: JenisSimpanan.WAJIB,
      nominal: 180000,
      catatan: 'Setoran wajib Februari',
    },
    {
      d: dt(2026, 2, 7),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-001',
      pinjaman: 'PJM-001',
      nominal: 700000,
      catatan: 'Angsuran kedua NB-001',
    },
    {
      d: dt(2026, 2, 8),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-008',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 500000,
      catatan: 'Setoran tambahan gaji',
    },
    {
      d: dt(2026, 2, 9),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-003',
      pinjaman: 'PJM-002',
      nominal: 950000,
      catatan: 'Angsuran kedua NB-003',
    },
    {
      d: dt(2026, 2, 10),
      t: JenisTransaksi.PENARIKAN,
      nasabah: 'NB-010',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 150000,
      catatan: 'Belanja kebutuhan dapur',
    },
    {
      d: dt(2026, 2, 11),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-005',
      rekening: JenisSimpanan.WAJIB,
      nominal: 150000,
      catatan: 'Setoran wajib Februari',
    },
    {
      d: dt(2026, 2, 12),
      t: JenisTransaksi.PENCAIRAN,
      nasabah: 'NB-009',
      pinjaman: 'PJM-004',
      nominal: 5000000,
      catatan: 'Pencairan modal pembesaran usaha',
    },
    {
      d: dt(2026, 2, 13),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-006',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 450000,
      catatan: 'Setoran dari penjualan ternak',
    },
    {
      d: dt(2026, 2, 14),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-007',
      pinjaman: 'PJM-003',
      nominal: 1000000,
      catatan: 'Angsuran pertama NB-007',
    },
    {
      d: dt(2026, 2, 15),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-009',
      rekening: JenisSimpanan.WAJIB,
      nominal: 250000,
      catatan: 'Setoran wajib Februari',
    },
    {
      d: dt(2026, 2, 16),
      t: JenisTransaksi.PENARIKAN,
      nasabah: 'NB-002',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 120000,
      catatan: 'Biaya berobat keluarga',
    },
    {
      d: dt(2026, 2, 17),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-001',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 600000,
      catatan: 'Setoran tambahan panen',
    },
    {
      d: dt(2026, 2, 18),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-009',
      pinjaman: 'PJM-004',
      nominal: 1100000,
      catatan: 'Angsuran pertama NB-009',
    },
    {
      d: dt(2026, 2, 20),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-007',
      rekening: JenisSimpanan.WAJIB,
      nominal: 200000,
      catatan: 'Setoran wajib Februari',
    },
    {
      d: dt(2026, 2, 21),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-008',
      rekening: JenisSimpanan.WAJIB,
      nominal: 200000,
      catatan: 'Setoran wajib Februari',
    },
    {
      d: dt(2026, 2, 22),
      t: JenisTransaksi.PENARIKAN,
      nasabah: 'NB-004',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 110000,
      catatan: 'Biaya transport dan pulsa',
    },
    {
      d: dt(2026, 2, 24),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-001',
      pinjaman: 'PJM-001',
      nominal: 800000,
      catatan: 'Angsuran ketiga NB-001',
    },
    {
      d: dt(2026, 2, 25),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-003',
      pinjaman: 'PJM-002',
      nominal: 1000000,
      catatan: 'Angsuran ketiga NB-003',
    },
    {
      d: dt(2026, 2, 27),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-010',
      rekening: JenisSimpanan.WAJIB,
      nominal: 180000,
      catatan: 'Setoran wajib Februari',
    },

    // Maret - 3 April (11 transaksi)
    {
      d: dt(2026, 3, 3),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-001',
      rekening: JenisSimpanan.WAJIB,
      nominal: 120000,
      catatan: 'Setoran wajib Maret',
    },
    {
      d: dt(2026, 3, 5),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-003',
      rekening: JenisSimpanan.WAJIB,
      nominal: 150000,
      catatan: 'Setoran wajib Maret',
    },
    {
      d: dt(2026, 3, 7),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-007',
      pinjaman: 'PJM-003',
      nominal: 950000,
      catatan: 'Angsuran kedua NB-007',
    },
    {
      d: dt(2026, 3, 9),
      t: JenisTransaksi.PENARIKAN,
      nasabah: 'NB-008',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 170000,
      catatan: 'Belanja kebutuhan rumah',
    },
    {
      d: dt(2026, 3, 10),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-009',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 380000,
      catatan: 'Setoran hasil penjualan mingguan',
    },
    {
      d: dt(2026, 3, 12),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-009',
      pinjaman: 'PJM-004',
      nominal: 1000000,
      catatan: 'Angsuran kedua NB-009',
    },
    {
      d: dt(2026, 3, 15),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-005',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 210000,
      catatan: 'Setoran panen kedua bulan Maret',
    },
    {
      d: dt(2026, 3, 19),
      t: JenisTransaksi.PENARIKAN,
      nasabah: 'NB-002',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 140000,
      catatan: 'Pembelian obat ternak',
    },
    {
      d: dt(2026, 3, 24),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-007',
      rekening: JenisSimpanan.WAJIB,
      nominal: 120000,
      catatan: 'Setoran wajib Maret',
    },
    {
      d: dt(2026, 3, 29),
      t: JenisTransaksi.ANGSURAN,
      nasabah: 'NB-001',
      pinjaman: 'PJM-001',
      nominal: 650000,
      catatan: 'Angsuran keempat NB-001',
    },
    {
      d: dt(2026, 4, 3),
      t: JenisTransaksi.SETORAN,
      nasabah: 'NB-003',
      rekening: JenisSimpanan.SUKARELA,
      nominal: 290000,
      catatan: 'Setoran awal April untuk kas koperasi',
    },
  ];

  // Hapus data dummy nasabah lama agar idempotent.
  const existingDummyNasabah = await prisma.nasabah.findMany({
    where: {
      OR: [
        { nomorAnggota: { startsWith: 'DMY2026-' } },
        { catatan: DUMMY_MARKER },
      ],
    },
    select: { id: true },
  });
  const dummyNasabahIds = existingDummyNasabah.map((n) => n.id);

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
    },
  });

  // Bersihkan pegawai dummy lama (berdasarkan prefix user) agar jumlah pegawai tepat 6 data.
  await prisma.pegawai.deleteMany({
    where: {
      user: {
        username: { startsWith: 'dummy2026.' },
      },
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
        statusAktif: spec.statusAktif,
      },
      create: {
        userId: user.id,
        nama: spec.nama,
        jabatan: spec.jabatan,
        noHp: spec.noHp,
        alamat: spec.alamat,
        statusAktif: spec.statusAktif,
      },
    });

    pegawaiByKey[spec.key] = pegawai;
  }

  const nasabahByCode = {};
  for (const spec of nasabahSpecs) {
    const nasabah = await prisma.nasabah.create({
      data: {
        pegawaiId: pegawaiByKey[spec.pegawaiKey].id,
        nomorAnggota: spec.nomorAnggota,
        nama: spec.nama,
        nik: spec.nik,
        alamat: spec.alamat,
        noHp: spec.noHp,
        pekerjaan: spec.pekerjaan,
        penghasilanBulanan: spec.penghasilanBulanan,
        tanggalLahir: spec.tanggalLahir,
        tanggalDaftar: spec.tanggalDaftar,
        status: spec.status,
        catatan: DUMMY_MARKER,
      },
    });

    nasabahByCode[spec.code] = nasabah;
  }

  const rekeningByNasabahAndJenis = {};
  for (const spec of nasabahSpecs) {
    const nasabah = nasabahByCode[spec.code];
    const saldo = rekeningAwal[spec.code];

    rekeningByNasabahAndJenis[spec.code] = {};

    for (const jenis of [
      JenisSimpanan.POKOK,
      JenisSimpanan.WAJIB,
      JenisSimpanan.SUKARELA,
    ]) {
      const rekening = await prisma.rekeningSimpanan.create({
        data: {
          nasabahId: nasabah.id,
          jenisSimpanan: jenis,
          saldoBerjalan: String(saldo[jenis]),
          createdAt: dt(2026, 1, 1, 8),
        },
      });

      rekeningByNasabahAndJenis[spec.code][jenis] = rekening;
    }
  }

  const pinjamanByCode = {};
  for (const spec of pinjamanSpecs) {
    const nasabah = nasabahByCode[spec.nasabahCode];

    const pinjaman = await prisma.pinjaman.create({
      data: {
        nasabahId: nasabah.id,
        jumlahPinjaman: String(spec.jumlahPinjaman),
        bungaPersen: spec.bungaPersen,
        tenorBulan: spec.tenorBulan,
        sisaPinjaman: String(spec.jumlahPinjaman),
        status: PinjamanStatus.DISETUJUI,
        verifiedById: pegawaiByKey['PGW-003'].id,
        tanggalPersetujuan: spec.tanggalPersetujuan,
      },
    });

    pinjamanByCode[spec.code] = pinjaman;
  }

  const kasirKeys = ['PGW-004', 'PGW-005'];
  let kasirTurn = 0;

  const totals = {
    '2026-01': { simpanan: 0, penarikan: 0, pencairan: 0, angsuran: 0 },
    '2026-02': { simpanan: 0, penarikan: 0, pencairan: 0, angsuran: 0 },
    '2026-03': { simpanan: 0, penarikan: 0, pencairan: 0, angsuran: 0 },
    '2026-04': { simpanan: 0, penarikan: 0, pencairan: 0, angsuran: 0 },
  };

  for (const tx of txPlan) {
    const nasabah = nasabahByCode[tx.nasabah];
    const key = monthKey(tx.d);

    let pegawaiId;
    if (tx.t === JenisTransaksi.PENCAIRAN) {
      pegawaiId = pegawaiByKey['PGW-003'].id;
    } else {
      pegawaiId = pegawaiByKey[kasirKeys[kasirTurn % kasirKeys.length]].id;
      kasirTurn += 1;
    }

    if (tx.t === JenisTransaksi.SETORAN || tx.t === JenisTransaksi.PENARIKAN) {
      const rekening = rekeningByNasabahAndJenis[tx.nasabah][tx.rekening];
      const beforeSaldo = Number(rekening.saldoBerjalan);
      const afterSaldo =
        tx.t === JenisTransaksi.SETORAN
          ? beforeSaldo + tx.nominal
          : beforeSaldo - tx.nominal;

      if (afterSaldo < 0) {
        throw new Error(
          `Saldo negatif untuk ${tx.nasabah} rekening ${tx.rekening} di ${tx.d.toISOString()}`,
        );
      }

      await prisma.transaksi.create({
        data: {
          nasabahId: nasabah.id,
          pegawaiId,
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
        totals[key].simpanan += tx.nominal;
      } else {
        totals[key].penarikan += tx.nominal;
      }
    }

    if (tx.t === JenisTransaksi.PENCAIRAN || tx.t === JenisTransaksi.ANGSURAN) {
      const pinjaman = pinjamanByCode[tx.pinjaman];

      // Menjaga urutan realistis: angsuran harus terjadi setelah pencairan pinjaman.
      if (
        tx.t === JenisTransaksi.ANGSURAN &&
        tx.d < pinjaman.tanggalPersetujuan
      ) {
        throw new Error(
          `Angsuran ${tx.pinjaman} terjadi sebelum tanggal persetujuan pinjaman.`,
        );
      }

      let nextSisa = Number(pinjaman.sisaPinjaman);
      let nextStatus = pinjaman.status;

      if (tx.t === JenisTransaksi.ANGSURAN) {
        nextSisa -= tx.nominal;
        if (nextSisa < 0) {
          throw new Error(
            `Angsuran melebihi sisa pinjaman untuk ${tx.pinjaman}.`,
          );
        }
        if (nextSisa === 0) {
          nextStatus = PinjamanStatus.LUNAS;
        }
      }

      await prisma.transaksi.create({
        data: {
          nasabahId: nasabah.id,
          pegawaiId,
          pinjamanId: pinjaman.id,
          jenisTransaksi: tx.t,
          nominal: String(tx.nominal),
          tanggal: tx.d,
          metodePembayaran:
            tx.t === JenisTransaksi.PENCAIRAN ? 'TRANSFER' : 'CASH',
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
        totals[key].pencairan += tx.nominal;
      } else {
        totals[key].angsuran += tx.nominal;
      }
    }
  }

  await prisma.rekeningSimpanan.update({
    where: {
      id: rekeningByNasabahAndJenis['NB-010'][JenisSimpanan.SUKARELA].id,
    },
    data: {
      deletedAt: dt(2026, 3, 26, 10, 0, 0),
    },
  });

  const generatedBy = await prisma.user.findUnique({
    where: { username: 'dummy2026.pimpinan' },
  });

  if (!generatedBy) {
    throw new Error(
      'User dummy2026.pimpinan tidak ditemukan untuk snapshot laporan.',
    );
  }

  const january = totals['2026-01'];
  const february = totals['2026-02'];

  const saldoAkhirJanuari =
    january.simpanan + january.angsuran - january.penarikan - january.pencairan;
  const saldoAkhirFebruari =
    saldoAkhirJanuari +
    february.simpanan +
    february.angsuran -
    february.penarikan -
    february.pencairan;

  await prisma.laporanKeuangan.create({
    data: {
      periodeBulan: 1,
      periodeTahun: 2026,
      totalSimpanan: String(january.simpanan),
      totalPenarikan: String(january.penarikan),
      totalPinjaman: String(january.pencairan),
      totalAngsuran: String(january.angsuran),
      saldoAkhir: String(saldoAkhirJanuari),
      statusLaporan: StatusLaporan.FINAL,
      generatedById: generatedBy.id,
      generatedAt: dt(2026, 2, 1, 9, 30, 0),
    },
  });

  await prisma.laporanKeuangan.create({
    data: {
      periodeBulan: 2,
      periodeTahun: 2026,
      totalSimpanan: String(february.simpanan),
      totalPenarikan: String(february.penarikan),
      totalPinjaman: String(february.pencairan),
      totalAngsuran: String(february.angsuran),
      saldoAkhir: String(saldoAkhirFebruari),
      statusLaporan: StatusLaporan.DRAFT,
      generatedById: generatedBy.id,
      generatedAt: dt(2026, 3, 1, 9, 30, 0),
    },
  });

  const summary = {
    pegawai: await prisma.pegawai.count({
      where: {
        user: {
          username: { startsWith: 'dummy2026.' },
        },
      },
    }),
    nasabah: await prisma.nasabah.count({
      where: { catatan: DUMMY_MARKER },
    }),
    transaksi: await prisma.transaksi.count({
      where: {
        nasabah: {
          catatan: DUMMY_MARKER,
        },
        tanggal: {
          gte: dt(2026, 1, 1, 0, 0, 0),
          lte: dt(2026, 4, 3, 23, 59, 59),
        },
      },
    }),
  };

  console.log('✅ Seed dummy koperasi Banyumas selesai.');
  console.log(`- Pegawai dummy: ${summary.pegawai} (target: 6)`);
  console.log(`- Nasabah dummy: ${summary.nasabah} (target: 10)`);
  console.log(
    `- Transaksi Jan 2026 s.d 3 Apr 2026: ${summary.transaksi} (target: 40-60)`,
  );
  console.log('- Ringkasan nominal per bulan:');
  console.log(totals);
}

seedDummyKoperasiBanyumas()
  .catch((error) => {
    console.error('❌ Seed dummy koperasi Banyumas gagal:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
