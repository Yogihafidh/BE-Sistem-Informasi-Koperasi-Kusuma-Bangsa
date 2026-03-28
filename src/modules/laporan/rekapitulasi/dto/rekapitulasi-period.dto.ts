import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class RekapitulasiPeriodDto {
  @ApiPropertyOptional({
    example: 3,
    description: 'Bulan laporan (1-12). Default: bulan saat ini.',
    minimum: 1,
    maximum: 12,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  bulan?: number;

  @ApiPropertyOptional({
    example: 2026,
    description: 'Tahun laporan. Default: tahun saat ini.',
    minimum: 2000,
  })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  tahun?: number;
}
