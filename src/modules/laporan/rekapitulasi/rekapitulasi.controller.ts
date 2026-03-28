import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RekapitulasiService } from './rekapitulasi.service';
import { Permissions } from '../../../common/decorators';
import { JwtAuthGuard, PermissionsGuard } from '../../../common/guards';
import { ApiAuthErrors } from '../../../common/decorators/api-docs.decorator';
import { RekapitulasiPeriodDto } from './dto';

@ApiTags('laporan')
@Controller('rekapitulasi')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RekapitulasiController {
  constructor(private readonly rekapitulasiService: RekapitulasiService) {}

  @Get('bulanan')
  @ApiBearerAuth('JWT-auth')
  @Permissions('laporan.read')
  @ApiOperation({
    summary: 'Rekapitulasi operasional bulanan (real-time)',
    description:
      'Menggabungkan transaksi, keuangan, anggota, rasio, dan performa bulanan secara real-time langsung dari database tanpa cache.',
  })
  @ApiQuery({
    name: 'bulan',
    required: false,
    description: 'Bulan laporan (1-12). Jika kosong, gunakan bulan saat ini.',
  })
  @ApiQuery({
    name: 'tahun',
    required: false,
    description: 'Tahun laporan. Jika kosong, gunakan tahun saat ini.',
  })
  @ApiResponse({
    status: 200,
    description: 'Rekapitulasi bulanan berhasil diambil',
  })
  @ApiAuthErrors()
  getBulanan(@Query() query: RekapitulasiPeriodDto) {
    return this.rekapitulasiService.getRekapitulasiBulanan(
      query.bulan,
      query.tahun,
    );
  }
}
