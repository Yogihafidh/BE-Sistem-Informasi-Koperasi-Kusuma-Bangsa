import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateNasabahDto {
  @ApiProperty({
    description: 'ID pegawai penanggung jawab nasabah',
    example: 2,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  pegawaiId?: number;

  @ApiProperty({
    description: 'Nama nasabah',
    example: 'Siti Aminah',
    required: false,
  })
  @IsOptional()
  @IsString()
  nama?: string;

  @ApiProperty({
    description: 'Alamat nasabah',
    example: 'Jl. Kenanga No. 12, Bandung',
    required: false,
  })
  @IsOptional()
  @IsString()
  alamat?: string;

  @ApiProperty({
    description: 'Nomor HP nasabah',
    example: '081234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  noHp?: string;

  @ApiProperty({
    description: 'Pekerjaan nasabah',
    example: 'Wiraswasta',
    required: false,
  })
  @IsOptional()
  @IsString()
  pekerjaan?: string;

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
    example: 6000000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  penghasilanBulanan?: number;

  @ApiProperty({
    description: 'Tanggal lahir (ISO string)',
    example: '1995-08-17',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  tanggalLahir?: string;

  @ApiProperty({
    description: 'Catatan (opsional)',
    example: 'Update data alamat',
    required: false,
  })
  @IsOptional()
  @IsString()
  catatan?: string;
}
