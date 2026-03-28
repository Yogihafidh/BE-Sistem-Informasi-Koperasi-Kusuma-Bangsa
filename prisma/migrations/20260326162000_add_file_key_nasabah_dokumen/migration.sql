-- Add canonical object key for nasabah documents
ALTER TABLE "NasabahDokumen"
ADD COLUMN "fileKey" TEXT;

-- Backfill from legacy fileUrl values (supports full URL, signed URL, or plain key)
UPDATE "NasabahDokumen"
SET "fileKey" = CASE
  WHEN "fileUrl" IS NULL THEN NULL
  WHEN "fileUrl" ~ '^https?://' THEN regexp_replace(split_part("fileUrl", '?', 1), '^https?://[^/]+/', '')
  ELSE split_part("fileUrl", '?', 1)
END;

-- Make fileKey mandatory and keep fileUrl as optional legacy field
ALTER TABLE "NasabahDokumen"
ALTER COLUMN "fileKey" SET NOT NULL;

ALTER TABLE "NasabahDokumen"
ALTER COLUMN "fileUrl" DROP NOT NULL;
