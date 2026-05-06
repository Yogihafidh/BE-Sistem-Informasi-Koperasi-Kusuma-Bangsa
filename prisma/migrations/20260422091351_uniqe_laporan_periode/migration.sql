-- AlterTable
ALTER TABLE "Pinjaman" ALTER COLUMN "totalPengembalian" DROP DEFAULT,
ALTER COLUMN "angsuranPerBulan" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Transaksi_jenisTransaksi_tanggal_idx" ON "Transaksi"("jenisTransaksi", "tanggal");
