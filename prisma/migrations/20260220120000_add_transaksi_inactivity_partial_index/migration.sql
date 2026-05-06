-- Partial index to speed up inactivity checks on approved, non-deleted transaksi
CREATE INDEX IF NOT EXISTS idx_transaksi_active_approved_nasabah_tanggal
ON "Transaksi" ("nasabahId", "tanggal")
WHERE "deletedAt" IS NULL AND "statusTransaksi" = 'APPROVED';
