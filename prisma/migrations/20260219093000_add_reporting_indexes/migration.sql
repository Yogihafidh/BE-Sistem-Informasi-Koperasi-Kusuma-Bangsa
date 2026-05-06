CREATE INDEX "Nasabah_status_deletedAt_idx" ON "Nasabah" ("status", "deletedAt");
CREATE INDEX "Nasabah_createdAt_idx" ON "Nasabah" ("createdAt");
CREATE INDEX "Nasabah_updatedAt_idx" ON "Nasabah" ("updatedAt");

CREATE INDEX "RekeningSimpanan_nasabahId_deletedAt_idx" ON "RekeningSimpanan" ("nasabahId", "deletedAt");
CREATE INDEX "RekeningSimpanan_jenisSimpanan_deletedAt_idx" ON "RekeningSimpanan" ("jenisSimpanan", "deletedAt");

CREATE INDEX "Pinjaman_nasabahId_idx" ON "Pinjaman" ("nasabahId");
CREATE INDEX "Pinjaman_status_deletedAt_idx" ON "Pinjaman" ("status", "deletedAt");
CREATE INDEX "Pinjaman_status_tanggalPersetujuan_idx" ON "Pinjaman" ("status", "tanggalPersetujuan");
CREATE INDEX "Pinjaman_status_sisaPinjaman_idx" ON "Pinjaman" ("status", "sisaPinjaman");

CREATE INDEX "Transaksi_nasabahId_tanggal_idx" ON "Transaksi" ("nasabahId", "tanggal");
CREATE INDEX "Transaksi_statusTransaksi_jenisTransaksi_tanggal_idx" ON "Transaksi" ("statusTransaksi", "jenisTransaksi", "tanggal");

CREATE INDEX "LaporanKeuangan_periodeTahun_periodeBulan_idx" ON "LaporanKeuangan" ("periodeTahun", "periodeBulan");
