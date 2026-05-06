import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RekapitulasiService } from './rekapitulasi.service';
import { Permissions } from '../../../common/decorators';
import { JwtAuthGuard, PermissionsGuard } from '../../../common/guards';
import {
  ApiAuthErrors,
  ApiNotFoundExample,
} from '../../../common/decorators/api-docs.decorator';
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
    summary: 'Rekapitulasi operasional bulanan (periodik)',
    description:
      'Menggabungkan transaksi, keuangan, anggota, rasio, dan performa berdasarkan rentang tanggal periode bulanan yang dipilih.',
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

  @Get('nasabah/:nasabahId')
  @ApiBearerAuth('JWT-auth')
  @Permissions('laporan.read')
  @ApiOperation({
    summary: 'Rekapitulasi bulanan per nasabah',
    description:
      'Menghasilkan ringkasan finansial, rasio, performa, dan insight rule-based untuk satu nasabah pada periode bulan tertentu.',
  })
  @ApiParam({
    name: 'nasabahId',
    description: 'ID nasabah',
    example: 1,
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
    description: 'Rekapitulasi nasabah berhasil diambil',
  })
  @ApiNotFoundExample('Nasabah tidak ditemukan')
  @ApiAuthErrors()
  getNasabah(
    @Param('nasabahId', ParseIntPipe) nasabahId: number,
    @Query() query: RekapitulasiPeriodDto,
  ) {
    return this.rekapitulasiService.getRekapitulasiNasabah(
      nasabahId,
      query.bulan,
      query.tahun,
    );
  }
}
