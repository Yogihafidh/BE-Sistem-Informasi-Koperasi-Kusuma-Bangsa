import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { JenisTransaksi } from '@prisma/client';

export enum MetodePembayaran {
  CASH = 'CASH',
  TRANSFER = 'TRANSFER',
  E_WALLET = 'E_WALLET',
}

export class CreateTransaksiDto {
  @ApiProperty({
    description: 'ID nasabah',
    example: 1,
  })
  @IsInt()
  nasabahId: number;

  @ApiProperty({
    description: 'ID rekening simpanan (wajib untuk transaksi simpanan)',
    example: 10,
    required: false,
  })
  @IsOptional()
  @IsInt()
  rekeningSimpananId?: number;

  @ApiProperty({
    description: 'ID pinjaman (wajib untuk transaksi pinjaman)',
    example: 5,
    required: false,
  })
  @IsOptional()
  @IsInt()
  pinjamanId?: number;

  @ApiProperty({
    description: 'Jenis transaksi',
    enum: JenisTransaksi,
    example: 'SETORAN',
  })
  @IsEnum(JenisTransaksi)
  jenisTransaksi: JenisTransaksi;

  @ApiProperty({
    description: 'Nominal transaksi',
    example: 150000,
  })
  @IsNumber()
  @Min(0.01)
  nominal: number;

  @ApiProperty({
    description: 'Tanggal transaksi (ISO string). Jika kosong, diisi otomatis.',
    example: '2026-02-09T10:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  tanggal?: string;

  @ApiProperty({
    description: 'Metode pembayaran',
    enum: MetodePembayaran,
    example: 'TRANSFER',
  })
  @IsEnum(MetodePembayaran)
  metodePembayaran: MetodePembayaran;

  @ApiProperty({
    description: 'Catatan transaksi (opsional)',
    example: 'Setoran simpanan wajib',
    required: false,
  })
  @IsOptional()
  @IsString()
  catatan?: string;
}
