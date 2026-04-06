const {
  PrismaClient,
  JenisTransaksi,
  NasabahStatus,
  PinjamanStatus,
} = require('@prisma/client');

const prisma = new PrismaClient();

const DUMMY_PREFIX = 'DMY2026-';
const DUMMY_MARKER = 'SEED_DUMMY_BANYUMAS_2026';
const YEAR = 2026;

function dt(yyyy, mm, dd, hh = 0, mi = 0, ss = 0) {
  return new Date(Date.UTC(yyyy, mm - 1, dd, hh, mi, ss));
}

function monthWindow(month) {
  return {
    start: dt(YEAR, month, 1, 0, 0, 0),
    end:
      month === 12
        ? dt(YEAR + 1, 1, 1, 0, 0, 0)
        : dt(YEAR, month + 1, 1, 0, 0, 0),
  };
}

function toNumber(value) {
  return value == null ? 0 : Number(value);
}

function prettyCurrency(num) {
  return new Intl.NumberFormat('id-ID').format(num);
}

async function sumTransaksiByJenis(args) {
  const grouped = await prisma.transaksi.groupBy({
    by: ['jenisTransaksi'],
    where: {
      deletedAt: null,
      nasabah: {
        OR: [
          { nomorAnggota: { startsWith: DUMMY_PREFIX } },
          { catatan: DUMMY_MARKER },
        ],
      },
      tanggal: {
        gte: args.start,
        lt: args.end,
      },
    },
    _sum: {
      nominal: true,
    },
  });

  const summary = {
    [JenisTransaksi.SETORAN]: 0,
    [JenisTransaksi.PENARIKAN]: 0,
    [JenisTransaksi.PENCAIRAN]: 0,
    [JenisTransaksi.ANGSURAN]: 0,
  };

  for (const row of grouped) {
    summary[row.jenisTransaksi] = toNumber(row._sum.nominal);
  }

  return summary;
}

async function main() {
  const findings = [];

  const check = (ok, message, detail = null) => {
    if (ok) {
      console.log(`✅ ${message}`);
    } else {
      console.log(`❌ ${message}`);
      if (detail) {
        console.log(`   ↳ ${detail}`);
      }
      findings.push({ message, detail });
    }
  };

  console.log('🔎 Validasi dummy koperasi dimulai...');

  const dummyNasabah = await prisma.nasabah.findMany({
    where: {
      OR: [
        { nomorAnggota: { startsWith: DUMMY_PREFIX } },
        { catatan: DUMMY_MARKER },
      ],
    },
    select: { id: true, nomorAnggota: true, status: true },
  });

  check(
    dummyNasabah.length >= 8,
    'Jumlah nasabah dummy minimal 8',
    `terbaca: ${dummyNasabah.length}`,
  );

  const dummyNasabahIds = dummyNasabah.map((n) => n.id);

  const rekeningCount = await prisma.rekeningSimpanan.count({
    where: {
      nasabahId: { in: dummyNasabahIds },
    },
  });
  check(
    rekeningCount === dummyNasabah.length * 3,
    'Setiap nasabah dummy memiliki 3 rekening simpanan',
    `rekening: ${rekeningCount}, nasabah: ${dummyNasabah.length}`,
  );

  const invalidSavingsTx = await prisma.transaksi.count({
    where: {
      deletedAt: null,
      nasabahId: { in: dummyNasabahIds },
      jenisTransaksi: {
        in: [JenisTransaksi.SETORAN, JenisTransaksi.PENARIKAN],
      },
      OR: [{ rekeningSimpananId: null }, { pinjamanId: { not: null } }],
    },
  });
  check(
    invalidSavingsTx === 0,
    'Relasi transaksi SETORAN/PENARIKAN valid (wajib rekening, tanpa pinjaman)',
    `invalid rows: ${invalidSavingsTx}`,
  );

  const invalidLoanTx = await prisma.transaksi.count({
    where: {
      deletedAt: null,
      nasabahId: { in: dummyNasabahIds },
      jenisTransaksi: {
        in: [JenisTransaksi.PENCAIRAN, JenisTransaksi.ANGSURAN],
      },
      OR: [{ pinjamanId: null }, { rekeningSimpananId: { not: null } }],
    },
  });
  check(
    invalidLoanTx === 0,
    'Relasi transaksi PENCAIRAN/ANGSURAN valid (wajib pinjaman, tanpa rekening)',
    `invalid rows: ${invalidLoanTx}`,
  );

  const january = await sumTransaksiByJenis(monthWindow(1));
  const february = await sumTransaksiByJenis(monthWindow(2));

  const januarySnapshot = await prisma.laporanKeuangan.findFirst({
    where: { periodeTahun: YEAR, periodeBulan: 1 },
    orderBy: { generatedAt: 'desc' },
  });
  const februarySnapshot = await prisma.laporanKeuangan.findFirst({
    where: { periodeTahun: YEAR, periodeBulan: 2 },
    orderBy: { generatedAt: 'desc' },
  });

  check(!!januarySnapshot, 'Snapshot laporan Januari 2026 tersedia');
  check(!!februarySnapshot, 'Snapshot laporan Februari 2026 tersedia');

  if (januarySnapshot) {
    check(
      toNumber(januarySnapshot.totalSimpanan) ===
        january[JenisTransaksi.SETORAN],
      'Snapshot Januari: totalSimpanan konsisten dengan transaksi SETORAN',
      `snapshot=${toNumber(januarySnapshot.totalSimpanan)}, transaksi=${january[JenisTransaksi.SETORAN]}`,
    );
    check(
      toNumber(januarySnapshot.totalPenarikan) ===
        january[JenisTransaksi.PENARIKAN],
      'Snapshot Januari: totalPenarikan konsisten dengan transaksi PENARIKAN',
      `snapshot=${toNumber(januarySnapshot.totalPenarikan)}, transaksi=${january[JenisTransaksi.PENARIKAN]}`,
    );
    check(
      toNumber(januarySnapshot.totalPinjaman) ===
        january[JenisTransaksi.PENCAIRAN],
      'Snapshot Januari: totalPinjaman konsisten dengan transaksi PENCAIRAN',
      `snapshot=${toNumber(januarySnapshot.totalPinjaman)}, transaksi=${january[JenisTransaksi.PENCAIRAN]}`,
    );
    check(
      toNumber(januarySnapshot.totalAngsuran) ===
        january[JenisTransaksi.ANGSURAN],
      'Snapshot Januari: totalAngsuran konsisten dengan transaksi ANGSURAN',
      `snapshot=${toNumber(januarySnapshot.totalAngsuran)}, transaksi=${january[JenisTransaksi.ANGSURAN]}`,
    );
  }

  if (februarySnapshot) {
    check(
      toNumber(februarySnapshot.totalSimpanan) ===
        february[JenisTransaksi.SETORAN],
      'Snapshot Februari: totalSimpanan konsisten dengan transaksi SETORAN',
      `snapshot=${toNumber(februarySnapshot.totalSimpanan)}, transaksi=${february[JenisTransaksi.SETORAN]}`,
    );
    check(
      toNumber(februarySnapshot.totalPenarikan) ===
        february[JenisTransaksi.PENARIKAN],
      'Snapshot Februari: totalPenarikan konsisten dengan transaksi PENARIKAN',
      `snapshot=${toNumber(februarySnapshot.totalPenarikan)}, transaksi=${february[JenisTransaksi.PENARIKAN]}`,
    );
    check(
      toNumber(februarySnapshot.totalPinjaman) ===
        february[JenisTransaksi.PENCAIRAN],
      'Snapshot Februari: totalPinjaman konsisten dengan transaksi PENCAIRAN',
      `snapshot=${toNumber(februarySnapshot.totalPinjaman)}, transaksi=${february[JenisTransaksi.PENCAIRAN]}`,
    );
    check(
      toNumber(februarySnapshot.totalAngsuran) ===
        february[JenisTransaksi.ANGSURAN],
      'Snapshot Februari: totalAngsuran konsisten dengan transaksi ANGSURAN',
      `snapshot=${toNumber(februarySnapshot.totalAngsuran)}, transaksi=${february[JenisTransaksi.ANGSURAN]}`,
    );
  }

  if (januarySnapshot && februarySnapshot) {
    const saldoAwalJanuari = 0;
    const expectedSaldoAkhirJanuari =
      saldoAwalJanuari +
      january[JenisTransaksi.SETORAN] +
      january[JenisTransaksi.ANGSURAN] -
      january[JenisTransaksi.PENARIKAN] -
      january[JenisTransaksi.PENCAIRAN];

    const expectedSaldoAkhirFebruari =
      expectedSaldoAkhirJanuari +
      february[JenisTransaksi.SETORAN] +
      february[JenisTransaksi.ANGSURAN] -
      february[JenisTransaksi.PENARIKAN] -
      february[JenisTransaksi.PENCAIRAN];

    check(
      toNumber(januarySnapshot.saldoAkhir) === expectedSaldoAkhirJanuari,
      'Snapshot Januari: saldoAkhir mengikuti rumus kas bulanan',
      `snapshot=${toNumber(januarySnapshot.saldoAkhir)}, expected=${expectedSaldoAkhirJanuari}`,
    );

    check(
      toNumber(februarySnapshot.saldoAkhir) === expectedSaldoAkhirFebruari,
      'Snapshot Februari: saldoAkhir mengikuti carry-over dari Januari',
      `snapshot=${toNumber(februarySnapshot.saldoAkhir)}, expected=${expectedSaldoAkhirFebruari}`,
    );
  }

  const loans = await prisma.pinjaman.findMany({
    where: {
      nasabah: {
        OR: [
          { nomorAnggota: { startsWith: DUMMY_PREFIX } },
          { catatan: DUMMY_MARKER },
        ],
      },
      deletedAt: null,
    },
    select: {
      id: true,
      jumlahPinjaman: true,
      sisaPinjaman: true,
      status: true,
    },
  });

  let invalidLoanBalance = 0;
  let invalidLoanStatus = 0;
  let expectedOutstanding = 0;

  for (const loan of loans) {
    const angsuranAgg = await prisma.transaksi.aggregate({
      where: {
        deletedAt: null,
        pinjamanId: loan.id,
        jenisTransaksi: JenisTransaksi.ANGSURAN,
      },
      _sum: { nominal: true },
    });

    const totalAngsuran = toNumber(angsuranAgg._sum.nominal);
    const expectedSisa = toNumber(loan.jumlahPinjaman) - totalAngsuran;
    const currentSisa = toNumber(loan.sisaPinjaman);

    if (expectedSisa !== currentSisa) {
      invalidLoanBalance += 1;
    }

    const expectedStatus =
      expectedSisa === 0 ? PinjamanStatus.LUNAS : PinjamanStatus.DISETUJUI;
    if (loan.status !== expectedStatus) {
      invalidLoanStatus += 1;
    }

    if (expectedSisa > 0) {
      expectedOutstanding += expectedSisa;
    }
  }

  check(
    invalidLoanBalance === 0,
    'Sisa pinjaman konsisten terhadap jumlahPinjaman - totalAngsuran',
    `loan tidak konsisten: ${invalidLoanBalance}`,
  );

  check(
    invalidLoanStatus === 0,
    'Status pinjaman konsisten (LUNAS jika sisa 0, selain itu DISETUJUI)',
    `status tidak konsisten: ${invalidLoanStatus}`,
  );

  const dashboardSaldoSimpanan = await prisma.rekeningSimpanan.aggregate({
    where: {
      deletedAt: null,
      nasabah: {
        OR: [
          { nomorAnggota: { startsWith: DUMMY_PREFIX } },
          { catatan: DUMMY_MARKER },
        ],
      },
    },
    _sum: { saldoBerjalan: true },
  });

  const dashboardOutstanding = await prisma.pinjaman.aggregate({
    where: {
      deletedAt: null,
      nasabah: {
        OR: [
          { nomorAnggota: { startsWith: DUMMY_PREFIX } },
          { catatan: DUMMY_MARKER },
        ],
      },
      status: PinjamanStatus.DISETUJUI,
    },
    _sum: { sisaPinjaman: true },
  });

  const dashboardOutstandingNum = toNumber(
    dashboardOutstanding._sum.sisaPinjaman,
  );

  check(
    dashboardOutstandingNum === expectedOutstanding,
    'Saldo dashboard total pinjaman aktif konsisten dengan perhitungan transaksi pinjaman',
    `dashboard=${dashboardOutstandingNum}, expected=${expectedOutstanding}`,
  );

  const nonaktifCount = dummyNasabah.filter(
    (n) => n.status === NasabahStatus.NONAKTIF,
  ).length;
  check(
    nonaktifCount >= 1,
    'Skenario edge case nasabah NONAKTIF tersedia',
    `jumlah nonaktif=${nonaktifCount}`,
  );

  const softDeletedRekening = await prisma.rekeningSimpanan.count({
    where: {
      nasabah: {
        OR: [
          { nomorAnggota: { startsWith: DUMMY_PREFIX } },
          { catatan: DUMMY_MARKER },
        ],
      },
      deletedAt: { not: null },
    },
  });
  check(
    softDeletedRekening >= 1,
    'Skenario edge case rekening soft-delete tersedia',
    `jumlah soft-delete=${softDeletedRekening}`,
  );

  console.log('');
  console.log('📊 Ringkasan angka kunci:');
  console.log(
    `- Total saldo simpanan aktif (dashboard): ${prettyCurrency(toNumber(dashboardSaldoSimpanan._sum.saldoBerjalan))}`,
  );
  console.log(
    `- Total outstanding pinjaman aktif (dashboard): ${prettyCurrency(dashboardOutstandingNum)}`,
  );
  console.log(
    `- Januari 2026 (Simpan/Tarik/Pencairan/Angsuran): ${prettyCurrency(january[JenisTransaksi.SETORAN])}/${prettyCurrency(january[JenisTransaksi.PENARIKAN])}/${prettyCurrency(january[JenisTransaksi.PENCAIRAN])}/${prettyCurrency(january[JenisTransaksi.ANGSURAN])}`,
  );
  console.log(
    `- Februari 2026 (Simpan/Tarik/Pencairan/Angsuran): ${prettyCurrency(february[JenisTransaksi.SETORAN])}/${prettyCurrency(february[JenisTransaksi.PENARIKAN])}/${prettyCurrency(february[JenisTransaksi.PENCAIRAN])}/${prettyCurrency(february[JenisTransaksi.ANGSURAN])}`,
  );

  if (findings.length > 0) {
    console.log('');
    console.log(`❌ Validasi selesai dengan ${findings.length} temuan.`);
    process.exitCode = 1;
    return;
  }

  console.log('');
  console.log(
    '✅ Semua validasi lolos. Data siap dipakai untuk uji stale cache dan konsistensi endpoint.',
  );
}

main()
  .catch((error) => {
    console.error('❌ Validator gagal dijalankan:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
