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

export class AngsuranPinjamanDto {
  @ApiProperty({
    description: 'Nominal angsuran',
    example: 300000,
  })
  @IsNumber()
  @Min(0.01)
  nominal: number;

  @ApiProperty({
    description: 'Metode pembayaran',
    enum: MetodePembayaran,
    example: 'CASH',
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
    example: 'Pembayaran angsuran bulan 1',
    required: false,
  })
  @IsOptional()
  @IsString()
  catatan?: string;
}
