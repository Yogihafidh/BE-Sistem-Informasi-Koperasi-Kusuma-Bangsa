-- Remove deprecated legacy column after switching to canonical fileKey
ALTER TABLE "NasabahDokumen"
DROP COLUMN "fileUrl";
