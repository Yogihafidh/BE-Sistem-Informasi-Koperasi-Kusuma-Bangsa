ALTER TABLE "Pinjaman"
ADD COLUMN "totalPengembalian" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "angsuranPerBulan" DECIMAL(65,30) NOT NULL DEFAULT 0;

UPDATE "Pinjaman"
SET
  "totalPengembalian" = "jumlahPinjaman" + (("jumlahPinjaman" * "bungaPersen" * "tenorBulan") / 100),
  "angsuranPerBulan" = CASE
    WHEN "tenorBulan" > 0 THEN
      ("jumlahPinjaman" + (("jumlahPinjaman" * "bungaPersen" * "tenorBulan") / 100)) / "tenorBulan"
    ELSE 0
  END;
