import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class LaporanPeriodDto {
  @ApiProperty({ example: 3, minimum: 1, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  bulan!: number;

  @ApiProperty({ example: 2026, minimum: 2000 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  tahun!: number;
}
