import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MetodePembayaran } from '../../transaksi/dto';

export class PencairanPinjamanDto {
  @ApiProperty({
    description: 'Nominal pencairan. Jika kosong, gunakan jumlah pinjaman.',
    example: 5000000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  nominal?: number;

  @ApiProperty({
    description: 'Metode pembayaran',
    enum: MetodePembayaran,
    example: 'TRANSFER',
  })
  @IsEnum(MetodePembayaran)
  metodePembayaran: MetodePembayaran;

  @ApiProperty({
    description: 'Tanggal transaksi (ISO string). Jika kosong, diisi otomatis.',
    example: '2026-02-09T10:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  tanggal?: string;

  @ApiProperty({
    description: 'Catatan transaksi (opsional)',
    example: 'Pencairan pinjaman',
    required: false,
  })
  @IsOptional()
  @IsString()
  catatan?: string;
}
