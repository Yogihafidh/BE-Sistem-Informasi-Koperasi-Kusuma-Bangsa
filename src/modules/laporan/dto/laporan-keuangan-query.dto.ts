import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min, ValidateIf } from 'class-validator';

export class LaporanKeuanganQueryDto {
  @ApiPropertyOptional({
    description:
      'Bulan laporan (1-12). Opsional jika ingin ambil laporan terbaru.',
    example: 3,
  })
  @ValidateIf((o: LaporanKeuanganQueryDto) => o.tahun !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  bulan?: number;

  @ApiPropertyOptional({
    description:
      'Tahun laporan (YYYY). Opsional jika ingin ambil laporan terbaru.',
    example: 2026,
  })
  @ValidateIf((o: LaporanKeuanganQueryDto) => o.bulan !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  tahun?: number;
}
