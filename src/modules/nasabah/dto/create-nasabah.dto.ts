import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateNasabahDto {
  @ApiProperty({
    description: 'Nama nasabah',
    example: 'Siti Aminah',
  })
  @IsNotEmpty()
  @IsString()
  nama: string;

  @ApiProperty({
    description: 'NIK nasabah',
    example: '3201010101010001',
  })
  @IsNotEmpty()
  @IsString()
  nik: string;

  @ApiProperty({
    description: 'Alamat nasabah',
    example: 'Jl. Kenanga No. 12, Bandung',
  })
  @IsNotEmpty()
  @IsString()
  alamat: string;

  @ApiProperty({
    description: 'Nomor HP nasabah',
    example: '081234567890',
  })
  @IsNotEmpty()
  @IsString()
  noHp: string;

  @ApiProperty({
    description: 'Pekerjaan nasabah',
    example: 'Wiraswasta',
  })
  @IsNotEmpty()
  @IsString()
  pekerjaan: string;

  @ApiProperty({
    description: 'Instansi (opsional)',
    example: 'PT Maju Jaya',
    required: false,
  })
  @IsOptional()
  @IsString()
  instansi?: string;

  @ApiProperty({
    description: 'Penghasilan bulanan',
    example: 5000000,
  })
  @IsNumber()
  @Min(0)
  penghasilanBulanan: number;

  @ApiProperty({
    description: 'Tanggal lahir (ISO string)',
    example: '1995-08-17',
  })
  @IsDateString()
  tanggalLahir: string;

  @ApiProperty({
    description:
      'Tanggal daftar (ISO string). Jika kosong akan diisi otomatis.',
    example: '2026-02-05',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  tanggalDaftar?: string;

  @ApiProperty({
    description: 'Catatan (opsional)',
    example: 'Dokumen lengkap',
    required: false,
  })
  @IsOptional()
  @IsString()
  catatan?: string;
}
