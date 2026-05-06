-- Add soft delete column for nasabah documents
ALTER TABLE "NasabahDokumen"
ADD COLUMN "deletedAt" TIMESTAMPTZ(3);

CREATE INDEX "NasabahDokumen_nasabahId_deletedAt_idx"
ON "NasabahDokumen"("nasabahId", "deletedAt");
