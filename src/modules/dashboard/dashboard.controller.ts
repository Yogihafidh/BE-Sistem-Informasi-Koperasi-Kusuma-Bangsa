import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardPeriodDto } from './dto';
import { Permissions } from '../../common/decorators';
import { JwtAuthGuard, PermissionsGuard } from '../../common/guards';
import { ApiAuthErrors } from '../../common/decorators/api-docs.decorator';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiBearerAuth('JWT-auth')
  @Permissions('dashboard.read')
  @ApiOperation({ summary: 'Ringkasan dashboard koperasi' })
  @ApiQuery({ name: 'bulan', required: true })
  @ApiQuery({ name: 'tahun', required: true })
  @ApiResponse({
    status: 200,
    description: 'Dashboard berhasil diambil',
    content: {
      'application/json': {
        example: {
          periode: { bulan: 3, tahun: 2026 },
          ringkasanKeuangan: {
            simpanan: 17000000,
            pinjamanOutstanding: 20000000,
            angsuranBulanIni: 3500000,
            penarikanBulanIni: 2500000,
            komposisiSimpanan: {
              pokok: 8000000,
              wajib: 6000000,
              sukarela: 3000000,
            },
          },
          performance: {
            simpanan: 0.08,
            transaksi: 0.12,
            anggota: 0.02,
          },
          aktivitasTransaksi: {
            cashflowTrend: [
              { bulan: 'Jan 2026', kasMasuk: 5800000, kasKeluar: 3900000 },
              { bulan: 'Feb 2026', kasMasuk: 7000000, kasKeluar: 4500000 },
              { bulan: 'Mar 2026', kasMasuk: 7600000, kasKeluar: 5000000 },
            ],
          },
          kreditPinjaman: {
            topOutstanding: [
              {
                pinjamanId: 10,
                namaAnggota: 'Budi Santoso',
                nominal: 7000000,
              },
              {
                pinjamanId: 12,
                namaAnggota: 'Siti Aminah',
                nominal: 5000000,
              },
            ],
          },
          keanggotaan: {
            total: 150,
            aktif: 120,
            tren: [
              { bulan: 'Jan 2026', anggotaBaru: 5, anggotaKeluar: 1 },
              { bulan: 'Feb 2026', anggotaBaru: 3, anggotaKeluar: 2 },
            ],
          },
          highlight: {
            cashflow: 'surplus',
            kondisi: 'stabil',
          },
        },
      },
    },
  })
  @ApiAuthErrors()
  getDashboard(@Query() query: DashboardPeriodDto) {
    return this.dashboardService.getDashboard(query.bulan, query.tahun);
  }
}
