WITH ranked AS (
	SELECT
		id,
		ROW_NUMBER() OVER (
			PARTITION BY "periodeBulan", "periodeTahun"
			ORDER BY
				CASE WHEN "statusLaporan" = 'FINAL' THEN 1 ELSE 0 END DESC,
				"generatedAt" DESC,
				id DESC
		) AS row_num
	FROM "LaporanKeuangan"
)
DELETE FROM "LaporanKeuangan" AS lk
USING ranked
WHERE lk.id = ranked.id
	AND ranked.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "LaporanKeuangan_periodeBulan_periodeTahun_key"
ON "LaporanKeuangan" ("periodeBulan", "periodeTahun");
