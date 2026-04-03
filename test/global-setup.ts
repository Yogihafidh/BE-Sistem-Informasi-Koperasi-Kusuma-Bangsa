import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

function isLikelyTestDatabase(url: string): boolean {
  const lowered = url.toLowerCase();
  return (
    lowered.includes('test') ||
    lowered.includes('_spec') ||
    lowered.includes('localhost')
  );
}

export default async function globalSetup() {
  // Prioritas env untuk test:
  // 1) .env.test
  // 2) .env (fallback)
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

  // Jika ada DATABASE_TEST_URL, pakai itu untuk seluruh test
  if (process.env.DATABASE_TEST_URL) {
    process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
  }

  process.env.TZ = 'Asia/Jakarta';
  process.env.NODE_ENV = 'test';

  // Validasi DATABASE_URL tersedia
  if (!process.env.DATABASE_URL) {
    throw new Error(
      '❌  DATABASE_URL tidak ditemukan. Pastikan file .env ada di root project.',
    );
  }

  const allowNonTestDb = process.env.ALLOW_TEST_ON_NON_TEST_DB === 'true';
  if (!allowNonTestDb && !isLikelyTestDatabase(process.env.DATABASE_URL)) {
    throw new Error(
      '❌  DATABASE_URL untuk integration test terlihat bukan database test. ' +
        'Set DATABASE_TEST_URL ke database khusus test (contoh: koperasi_test), ' +
        'atau set ALLOW_TEST_ON_NON_TEST_DB=true jika memang sengaja.',
    );
  }

  console.log(
    `\n🔗  Database URL: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@')}`,
  );

  // Pastikan database test sudah di-migrate
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'pipe',
      env: { ...process.env },
    });
    console.log('✅  Prisma migrate deploy berhasil');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      '❌  Prisma migrate deploy gagal. Hentikan test untuk mencegah schema drift.\n' +
        message.slice(0, 500),
    );
  }
}
