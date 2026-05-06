import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreatePegawaiDto {
  @ApiProperty({
    description: 'ID user yang akan dihubungkan ke pegawai',
    example: 1,
  })
  @IsInt()
  userId: number;

  @ApiProperty({
    description: 'Nama pegawai',
    example: 'Budi Santoso',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  nama: string;

  @ApiProperty({
    description: 'Jabatan pegawai',
    example: 'Kasir',
  })
  @IsNotEmpty()
  @IsString()
  jabatan: string;

  @ApiProperty({
    description: 'Nomor HP pegawai',
    example: '081234567890',
  })
  @IsNotEmpty()
  @IsString()
  noHp: string;

  @ApiProperty({
    description: 'Alamat pegawai',
    example: 'Jl. Melati No. 10, Bandung',
  })
  @IsNotEmpty()
  @IsString()
  alamat: string;
}
