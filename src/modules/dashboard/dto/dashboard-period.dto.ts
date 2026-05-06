import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class DashboardPeriodDto {
  @ApiProperty({
    description: 'Bulan dashboard (1-12)',
    example: 2,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  bulan: number;

  @ApiProperty({
    description: 'Tahun dashboard (YYYY)',
    example: 2026,
  })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  tahun: number;
}
