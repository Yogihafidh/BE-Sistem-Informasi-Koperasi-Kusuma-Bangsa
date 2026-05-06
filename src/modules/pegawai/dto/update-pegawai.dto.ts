import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdatePegawaiDto {
  @ApiProperty({
    description: 'Nama pegawai',
    example: 'Budi Santoso',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  nama?: string;

  @ApiProperty({
    description: 'Jabatan pegawai',
    example: 'Kasir',
    required: false,
  })
  @IsOptional()
  @IsString()
  jabatan?: string;

  @ApiProperty({
    description: 'Nomor HP pegawai',
    example: '081234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  noHp?: string;

  @ApiProperty({
    description: 'Alamat pegawai',
    example: 'Jl. Melati No. 10, Bandung',
    required: false,
  })
  @IsOptional()
  @IsString()
  alamat?: string;
}
