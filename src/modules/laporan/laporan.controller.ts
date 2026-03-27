import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LaporanService } from './laporan.service';
import {
  LaporanKeuanganQueryDto,
  LaporanKeuanganResponseDto,
  LaporanPeriodDto,
} from './dto';
import { CurrentUser, Permissions } from '../../common/decorators';
import { JwtAuthGuard, PermissionsGuard } from '../../common/guards';
import { ApiAuthErrors } from '../../common/decorators/api-docs.decorator';
import type { UserFromJwt } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('laporan')
@Controller('laporan')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LaporanController {
  constructor(private readonly laporanService: LaporanService) {}

  @Get('bulanan')
  @ApiBearerAuth('JWT-auth')
  @Permissions('laporan.read')
  @ApiOperation({ summary: 'Laporan bulanan (executive summary)' })
  @ApiQuery({ name: 'bulan', required: true })
  @ApiQuery({ name: 'tahun', required: true })
  @ApiResponse({
    status: 200,
    description: 'Laporan bulanan berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil laporan bulanan',
          data: {
            periode: { bulan: 2, tahun: 2026 },
            summary: {
              totalSimpananMasuk: 15000000,
              totalPinjamanDiberikan: 20000000,
              totalAngsuranDiterima: 3500000,
              totalPenarikan: 2500000,
              saldoAwal: 10000000,
              saldoAkhir: 26000000,
              anggotaAktif: 120,
              totalAnggota: 150,
              anggotaBaru: 5,
              anggotaKeluar: 2,
            },
            performance: {
              growthSimpanan: 0.08,
              growthPinjaman: 0.12,
              growthTransaksi: 0.15,
              growthAnggota: 0.02,
              netCashflow: 6000000,
            },
            financialIndicators: {
              rasioLikuiditas: 2.4,
              rasioKreditAktif: 0.8,
              rasioCashCoverage: 1.3,
              rasioKeaktifanAnggota: 0.8,
            },
          },
        },
      },
    },
  })
  @ApiAuthErrors()
  getLaporanBulanan(@Query() query: LaporanPeriodDto) {
    return this.laporanService.getLaporanBulanan(query.bulan, query.tahun);
  }

  @Get('transaksi')
  @ApiBearerAuth('JWT-auth')
  @Permissions('laporan.read')
  @ApiOperation({ summary: 'Laporan transaksi lengkap' })
  @ApiQuery({ name: 'bulan', required: true })
  @ApiQuery({ name: 'tahun', required: true })
  @ApiResponse({
    status: 200,
    description: 'Laporan transaksi berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil laporan transaksi',
          data: {
            periode: { bulan: 2, tahun: 2026 },
            summary: {
              totalTransaksi: 120,
              totalNominal: 38000000,
              rataRataPerHari: 4,
            },
            breakdown: {
              SETORAN: {
                jumlah: 60,
                total: 12000000,
                rataRataNominal: 200000,
                persentaseDariTotalNominal: 0.31,
              },
              PENARIKAN: {
                jumlah: 20,
                total: 2500000,
                rataRataNominal: 125000,
                persentaseDariTotalNominal: 0.07,
              },
              PENCAIRAN: {
                jumlah: 5,
                total: 20000000,
                rataRataNominal: 4000000,
                persentaseDariTotalNominal: 0.52,
              },
              ANGSURAN: {
                jumlah: 35,
                total: 3500000,
                rataRataNominal: 100000,
                persentaseDariTotalNominal: 0.09,
              },
            },
          },
        },
      },
    },
  })
  @ApiAuthErrors()
  getLaporanTransaksi(@Query() query: LaporanPeriodDto) {
    return this.laporanService.getLaporanTransaksi(query.bulan, query.tahun);
  }

  @Get('angsuran')
  @ApiBearerAuth('JWT-auth')
  @Permissions('laporan.read')
  @ApiOperation({ summary: 'Laporan angsuran' })
  @ApiQuery({ name: 'bulan', required: true })
  @ApiQuery({ name: 'tahun', required: true })
  @ApiResponse({
    status: 200,
    description: 'Laporan angsuran berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil laporan angsuran',
          data: {
            periode: { bulan: 2, tahun: 2026 },
            summary: {
              totalAngsuranMasuk: 3500000,
              jumlahTransaksi: 35,
              rataRataAngsuran: 100000,
            },
            metrics: {
              rasioPembayaranLancar: 0.22,
              coverageTerhadapPencairan: 1.4,
              rataRataPerPeminjam: 437500,
            },
          },
        },
      },
    },
  })
  @ApiAuthErrors()
  getLaporanAngsuran(@Query() query: LaporanPeriodDto) {
    return this.laporanService.getLaporanAngsuran(query.bulan, query.tahun);
  }

  @Get('penarikan')
  @ApiBearerAuth('JWT-auth')
  @Permissions('laporan.read')
  @ApiOperation({ summary: 'Laporan penarikan' })
  @ApiQuery({ name: 'bulan', required: true })
  @ApiQuery({ name: 'tahun', required: true })
  @ApiResponse({
    status: 200,
    description: 'Laporan penarikan berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil laporan penarikan',
          data: {
            periode: { bulan: 2, tahun: 2026 },
            summary: {
              totalPenarikan: 2500000,
              jumlahTransaksi: 20,
              rataRataPenarikan: 125000,
            },
            metrics: {
              rasioTerhadapSimpanan: 0.18,
              pertumbuhanDariBulanLalu: 0.12,
              konsentrasiTop3: 0.46,
            },
          },
        },
      },
    },
  })
  @ApiAuthErrors()
  getLaporanPenarikan(@Query() query: LaporanPeriodDto) {
    return this.laporanService.getLaporanPenarikan(query.bulan, query.tahun);
  }

  @Get('pinjaman')
  @ApiBearerAuth('JWT-auth')
  @Permissions('laporan.read')
  @ApiOperation({ summary: 'Laporan pinjaman' })
  @ApiQuery({ name: 'bulan', required: true })
  @ApiQuery({ name: 'tahun', required: true })
  @ApiResponse({
    status: 200,
    description: 'Laporan pinjaman berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil laporan pinjaman',
          data: {
            periode: { bulan: 2, tahun: 2026 },
            summary: {
              totalPinjamanAktif: 8,
              totalOutstanding: 20000000,
              pinjamanBaru: 3,
            },
            metrics: {
              rasioPinjamanTerhadapSimpanan: 0.72,
              konsentrasiTop5: 0.55,
              rataRataOutstanding: 2500000,
            },
          },
        },
      },
    },
  })
  @ApiAuthErrors()
  getLaporanPinjaman(@Query() query: LaporanPeriodDto) {
    return this.laporanService.getLaporanPinjaman(query.bulan, query.tahun);
  }

  @Get('simpanan')
  @ApiBearerAuth('JWT-auth')
  @Permissions('laporan.read')
  @ApiOperation({ summary: 'Laporan simpanan' })
  @ApiQuery({ name: 'bulan', required: true })
  @ApiQuery({ name: 'tahun', required: true })
  @ApiResponse({
    status: 200,
    description: 'Laporan simpanan berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil laporan simpanan',
          data: {
            periode: { bulan: 2, tahun: 2026 },
            summary: {
              totalSimpanan: 17000000,
              simpananPokok: 8000000,
              simpananWajib: 6000000,
              simpananSukarela: 3000000,
            },
            metrics: {
              growthSimpanan: 0.08,
              rasioSukarela: 0.17,
              rataRataSaldoAnggota: 850000,
            },
          },
        },
      },
    },
  })
  @ApiAuthErrors()
  getLaporanSimpanan(@Query() query: LaporanPeriodDto) {
    return this.laporanService.getLaporanSimpanan(query.bulan, query.tahun);
  }

  @Get('cashflow')
  @ApiBearerAuth('JWT-auth')
  @Permissions('laporan.read')
  @ApiOperation({ summary: 'Laporan cashflow' })
  @ApiQuery({ name: 'bulan', required: true })
  @ApiQuery({ name: 'tahun', required: true })
  @ApiResponse({
    status: 200,
    description: 'Laporan cashflow berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil laporan cashflow',
          data: {
            periode: { bulan: 2, tahun: 2026 },
            summary: {
              saldoAwal: 10000000,
              pemasukan: 15500000,
              pengeluaran: 22500000,
              surplus: -7000000,
              saldoAkhir: 3000000,
            },
            rasio: {
              rasioLikuiditas: 1.2,
              rasioPengeluaran: 1.45,
            },
            tren: {
              surplusDelta: -1000000,
              defisitBeruntun: 2,
            },
          },
        },
      },
    },
  })
  @ApiAuthErrors()
  getLaporanCashflow(@Query() query: LaporanPeriodDto) {
    return this.laporanService.getLaporanCashflow(query.bulan, query.tahun);
  }

  @Get('anggota')
  @ApiBearerAuth('JWT-auth')
  @Permissions('laporan.read')
  @ApiOperation({ summary: 'Laporan anggota' })
  @ApiQuery({ name: 'bulan', required: true })
  @ApiQuery({ name: 'tahun', required: true })
  @ApiResponse({
    status: 200,
    description: 'Laporan anggota berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil laporan anggota',
          data: {
            periode: { bulan: 2, tahun: 2026 },
            population: {
              totalTerdaftar: 150,
              anggotaAktif: 120,
              anggotaBaru: 5,
              anggotaKeluar: 2,
            },
            kredit: {
              anggotaDenganPinjamanAktif: 8,
              rataRataPinjamanPerAnggota: 2500000,
            },
            rasio: {
              rasioKeaktifan: 0.8,
              rasioPertumbuhan: 0.02,
              rasioPartisipasiTransaksi: 0.7,
              rasioPinjamanAktif: 0.06,
            },
          },
        },
      },
    },
  })
  @ApiAuthErrors()
  getLaporanAnggota(@Query() query: LaporanPeriodDto) {
    return this.laporanService.getLaporanAnggota(query.bulan, query.tahun);
  }

  @Post('keuangan/generate')
  @ApiBearerAuth('JWT-auth')
  @Permissions('laporan.generate')
  @ApiOperation({ summary: 'Generate laporan keuangan (snapshot)' })
  @ApiQuery({ name: 'bulan', required: true })
  @ApiQuery({ name: 'tahun', required: true })
  @ApiResponse({
    status: 201,
    description: 'Laporan keuangan berhasil di-generate',
    content: {
      'application/json': {
        example: {
          message: 'Laporan keuangan berhasil di-generate',
          data: {
            id: 1,
            periodeBulan: 2,
            periodeTahun: 2026,
            totalSimpanan: 12000000,
            totalPenarikan: 2500000,
            totalPinjaman: 20000000,
            totalAngsuran: 3500000,
            saldoAkhir: 26000000,
            statusLaporan: 'DRAFT',
            generatedById: 1,
            generatedAt: '2026-02-11T08:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiAuthErrors()
  generateLaporanKeuangan(
    @Query() query: LaporanPeriodDto,
    @CurrentUser() user: UserFromJwt,
  ) {
    return this.laporanService.generateLaporanKeuangan(
      query.bulan,
      query.tahun,
      user.userId,
    );
  }

  @Get('keuangan')
  @ApiBearerAuth('JWT-auth')
  @Permissions('laporan.read')
  @ApiOperation({
    summary: 'Lihat laporan keuangan koperasi (snapshot)',
    description:
      'Mengambil snapshot laporan keuangan terbaru atau berdasarkan periode tanpa menghitung ulang dari tabel transaksi.',
  })
  @ApiQuery({
    name: 'bulan',
    required: false,
    description: 'Bulan laporan (1-12). Opsional.',
  })
  @ApiQuery({
    name: 'tahun',
    required: false,
    description: 'Tahun laporan (YYYY). Opsional.',
  })
  @ApiResponse({
    status: 200,
    description: 'Laporan keuangan berhasil diambil',
    content: {
      'application/json': {
        example: {
          periodeBulan: 2,
          periodeTahun: 2026,
          saldoAwal: 10000000,
          totalSimpanan: 12000000,
          totalAngsuran: 3500000,
          totalPenarikan: 2500000,
          totalPinjaman: 20000000,
          totalPemasukan: 15500000,
          totalPengeluaran: 22500000,
          netCashflow: -7000000,
          saldoAkhir: 3000000,
          statusLaporan: 'DRAFT',
          generatedById: 1,
          generatedAt: '2026-02-11T08:00:00.000Z',
        },
      },
    },
    type: LaporanKeuanganResponseDto,
  })
  @ApiAuthErrors()
  getLaporanKeuangan(@Query() query: LaporanKeuanganQueryDto) {
    return this.laporanService.getLaporanKeuanganSnapshot(
      query.bulan,
      query.tahun,
    );
  }

  @Post('keuangan/:id/finalize')
  @ApiBearerAuth('JWT-auth')
  @Permissions('laporan.finalize')
  @ApiOperation({ summary: 'Finalisasi laporan keuangan (snapshot)' })
  @ApiResponse({
    status: 200,
    description: 'Laporan keuangan berhasil difinalisasi',
    content: {
      'application/json': {
        example: {
          message: 'Laporan keuangan berhasil difinalisasi',
          data: {
            id: 1,
            periodeBulan: 2,
            periodeTahun: 2026,
            totalSimpanan: 12000000,
            totalPenarikan: 2500000,
            totalPinjaman: 20000000,
            totalAngsuran: 3500000,
            saldoAkhir: 26000000,
            statusLaporan: 'FINAL',
            generatedById: 1,
            generatedAt: '2026-02-11T08:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiAuthErrors()
  finalizeLaporanKeuangan(@Param('id', ParseIntPipe) id: number) {
    return this.laporanService.finalizeLaporanKeuangan(id);
  }
}
