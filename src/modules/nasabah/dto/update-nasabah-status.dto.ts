import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { NasabahStatus } from '@prisma/client';

export class UpdateNasabahStatusDto {
  @ApiProperty({
    description:
      'Status keanggotaan nasabah. Input yang diterima: AKTIF (aktif kembali) atau NONAKTIF (nasabah keluar/tidak aktif).',
    enum: ['AKTIF', 'NONAKTIF'],
    example: 'NONAKTIF',
  })
  @IsEnum(NasabahStatus)
  status: NasabahStatus;
}
