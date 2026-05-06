import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, Min } from 'class-validator';

export class CreatePinjamanDto {
  @ApiProperty({
    description: 'ID nasabah',
    example: 1,
  })
  @IsInt()
  nasabahId: number;

  @ApiProperty({
    description: 'Jumlah pinjaman',
    example: 5000000,
  })
  @IsNumber()
  @Min(0.01)
  jumlahPinjaman: number;

  @ApiProperty({
    description: 'Tenor pinjaman dalam bulan',
    example: 12,
  })
  @IsInt()
  @Min(1)
  tenorBulan: number;
}
