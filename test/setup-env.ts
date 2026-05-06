import * as path from 'node:path';
import * as dotenv from 'dotenv';

// Prioritas env untuk test:
// 1) .env.test
// 2) .env (fallback)
dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Jika ada DATABASE_TEST_URL, pakai itu untuk seluruh test
if (process.env.DATABASE_TEST_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
}

// Override untuk mode test
process.env.NODE_ENV = 'test';
process.env.TZ = 'Asia/Jakarta';
