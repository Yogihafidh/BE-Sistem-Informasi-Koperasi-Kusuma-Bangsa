ALTER TYPE "PinjamanStatus" ADD VALUE IF NOT EXISTS 'TERLAMBAT';

ALTER TABLE "Pinjaman"
ADD COLUMN "jatuhTempo" TIMESTAMPTZ(3);

UPDATE "Pinjaman"
SET "jatuhTempo" = "tanggalPersetujuan" + ("tenorBulan" || ' months')::interval
WHERE "tanggalPersetujuan" IS NOT NULL;
