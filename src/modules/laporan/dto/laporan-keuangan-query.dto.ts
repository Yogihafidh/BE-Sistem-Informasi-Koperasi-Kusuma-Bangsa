import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class LaporanKeuanganQueryDto {
  @ApiPropertyOptional({ example: 3, minimum: 1, maximum: 12 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  bulan?: number;

  @ApiPropertyOptional({ example: 2026, minimum: 2000 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(2000)
  tahun?: number;
}
