import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PinjamanStatus } from '@prisma/client';

export class VerifikasiPinjamanDto {
  @ApiProperty({
    description: 'Status verifikasi pinjaman',
    enum: ['DISETUJUI', 'DITOLAK'],
    example: 'DISETUJUI',
  })
  @IsEnum(PinjamanStatus)
  status: PinjamanStatus;

  @ApiProperty({
    description: 'Catatan verifikasi (opsional)',
    example: 'Dokumen lengkap',
    required: false,
  })
  @IsOptional()
  @IsString()
  catatan?: string;
}
