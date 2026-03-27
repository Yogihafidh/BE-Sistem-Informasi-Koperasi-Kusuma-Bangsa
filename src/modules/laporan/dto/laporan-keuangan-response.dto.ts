import { ApiProperty } from '@nestjs/swagger';

export class LaporanKeuanganResponseDto {
  @ApiProperty({ example: 3 })
  periodeBulan: number;

  @ApiProperty({ example: 2026 })
  periodeTahun: number;

  @ApiProperty({ example: 12000000 })
  saldoAwal: number;

  @ApiProperty({ example: 15000000 })
  totalSimpanan: number;

  @ApiProperty({ example: 3500000 })
  totalAngsuran: number;

  @ApiProperty({ example: 2500000 })
  totalPenarikan: number;

  @ApiProperty({ example: 20000000 })
  totalPinjaman: number;

  @ApiProperty({ example: 18500000 })
  totalPemasukan: number;

  @ApiProperty({ example: 22500000 })
  totalPengeluaran: number;

  @ApiProperty({ example: -4000000 })
  netCashflow: number;

  @ApiProperty({ example: 8000000 })
  saldoAkhir: number;

  @ApiProperty({ example: 'DRAFT' })
  statusLaporan: string;

  @ApiProperty({ example: 1 })
  generatedById: number;

  @ApiProperty({ example: '2026-03-11T08:00:00.000Z' })
  generatedAt: string;
}
