-- Drop index that depends on statusTransaksi
DROP INDEX IF EXISTS "Transaksi_statusTransaksi_jenisTransaksi_tanggal_idx";

-- Drop partial index that filtered approved transactions
DROP INDEX IF EXISTS "Transaksi_nasabah_tanggal_active_approved_idx";

-- Drop status column from transaksi
ALTER TABLE "Transaksi"
DROP COLUMN IF EXISTS "statusTransaksi";

-- Drop enum type if no longer used
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'StatusTransaksi'
  ) THEN
    DROP TYPE "StatusTransaksi";
  END IF;
END $$;
