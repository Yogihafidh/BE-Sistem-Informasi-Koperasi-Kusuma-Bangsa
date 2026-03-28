import { ApiPropertyOptional } from '@nestjs/swagger';
import { PinjamanStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsInt, IsEnum, IsOptional, Min } from 'class-validator';

export enum PinjamanNominalSort {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListPinjamanQueryDto {
  @ApiPropertyOptional({
    example: 130,
    description: 'Cursor maju. Ambil data setelah ID ini.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  after?: number;

  @ApiPropertyOptional({
    example: 130,
    description: 'Cursor mundur. Ambil data sebelum ID ini.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  before?: number;

  @ApiPropertyOptional({
    example: 130,
    description:
      'Alias legacy untuk after. Tetap didukung agar backward-compatible.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cursor?: number;

  @ApiPropertyOptional({
    enum: PinjamanStatus,
    description: 'Filter data pinjaman berdasarkan status',
  })
  @IsOptional()
  @IsEnum(PinjamanStatus)
  status?: PinjamanStatus;

  @ApiPropertyOptional({
    enum: PinjamanNominalSort,
    default: PinjamanNominalSort.DESC,
    description: 'Urutan nominal pinjaman: asc (kecil ke besar) atau desc',
  })
  @IsOptional()
  @IsEnum(PinjamanNominalSort)
  sort?: PinjamanNominalSort;
}
