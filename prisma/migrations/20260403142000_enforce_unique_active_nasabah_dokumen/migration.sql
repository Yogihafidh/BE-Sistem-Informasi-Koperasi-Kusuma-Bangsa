-- Ensure there is only one active document per jenis for each nasabah.
-- Cleanup legacy duplicates by keeping the newest active row and soft deleting older rows.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "nasabahId", "jenisDokumen"
      ORDER BY "uploadedAt" DESC, id DESC
    ) AS rn
  FROM "NasabahDokumen"
  WHERE "deletedAt" IS NULL
)
UPDATE "NasabahDokumen" nd
SET "deletedAt" = NOW()
FROM ranked r
WHERE nd.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX "NasabahDokumen_unique_active_nasabah_jenis_idx"
ON "NasabahDokumen"("nasabahId", "jenisDokumen")
WHERE "deletedAt" IS NULL;
