import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { Permissions } from '../../common/decorators';
import { JwtAuthGuard, PermissionsGuard } from '../../common/guards';
import { ApiAuthErrors } from '../../common/decorators/api-docs.decorator';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  // Swagger dokumentation
  @ApiBearerAuth('JWT-auth')
  @Permissions('dashboard.read')
  @ApiOperation({ summary: 'Ringkasan dashboard koperasi' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard berhasil diambil',
    content: {
      'application/json': {
        example: {
          context: { generatedAt: '2026-04-02T10:00:00.000Z' },
          ringkasanUtama: {
            totalSimpanan: 17000000,
            totalPinjamanOutstanding: 20000000,
            totalAnggota: 150,
            anggotaAktif: 120,
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
            tren: [
              { bulan: 'Jan 2026', anggotaBaru: 5, anggotaKeluar: 1 },
              { bulan: 'Feb 2026', anggotaBaru: 3, anggotaKeluar: 2 },
            ],
          },
        },
      },
    },
  })
  @ApiAuthErrors()

  // Logic
  @Get()
  getDashboard() {
    return this.dashboardService.getDashboard();
  }
}
