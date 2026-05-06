import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { NasabahStatus } from '@prisma/client';

export class VerifikasiNasabahDto {
  @ApiProperty({
    description:
      'Status verifikasi nasabah. Input yang diterima: AKTIF (menyetujui, nasabah aktif) atau DITOLAK (menolak). Status awal registrasi adalah PENDING (menunggu verifikasi).',
    enum: ['AKTIF', 'DITOLAK'],
    example: 'AKTIF',
  })
  @IsEnum(NasabahStatus)
  status: NasabahStatus;

  @ApiProperty({
    description: 'Catatan verifikasi (opsional)',
    example: 'Dokumen valid',
    required: false,
  })
  @IsOptional()
  @IsString()
  catatan?: string;
}
