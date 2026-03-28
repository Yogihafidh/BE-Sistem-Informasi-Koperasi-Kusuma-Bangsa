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
import { CurrentUser, Permissions } from '../../common/decorators';
import { JwtAuthGuard, PermissionsGuard } from '../../common/guards';
import { ApiAuthErrors } from '../../common/decorators/api-docs.decorator';
import { LaporanKeuanganQueryDto, LaporanPeriodDto } from './dto';
import type { UserFromJwt } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('laporan')
@Controller('laporan')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LaporanController {
  constructor(private readonly laporanService: LaporanService) {}

  @Post('keuangan/generate')
  @ApiBearerAuth('JWT-auth')
  @Permissions('laporan.generate')
  @ApiOperation({ summary: 'Generate laporan keuangan (snapshot)' })
  @ApiQuery({ name: 'bulan', required: true })
  @ApiQuery({ name: 'tahun', required: true })
  @ApiResponse({
    status: 201,
    description: 'Laporan keuangan snapshot berhasil di-generate',
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
  @ApiOperation({ summary: 'Lihat laporan keuangan (snapshot)' })
  @ApiResponse({ status: 200, description: 'Snapshot laporan keuangan' })
  @ApiAuthErrors()
  getLaporanKeuangan(@Query() query: LaporanKeuanganQueryDto) {
    const service = this.laporanService as unknown as {
      getLaporanKeuanganSnapshot: (
        bulan?: number,
        tahun?: number,
      ) => Promise<unknown>;
    };

    return service.getLaporanKeuanganSnapshot(query.bulan, query.tahun);
  }

  @Post('keuangan/:id/finalize')
  @ApiBearerAuth('JWT-auth')
  @Permissions('laporan.finalize')
  @ApiOperation({ summary: 'Finalisasi laporan keuangan (snapshot)' })
  @ApiResponse({
    status: 201,
    description: 'Laporan keuangan snapshot berhasil difinalisasi',
  })
  @ApiAuthErrors()
  finalizeLaporanKeuangan(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserFromJwt,
  ) {
    const service = this.laporanService as unknown as {
      finalizeLaporanKeuangan: (
        laporanId: number,
        userId: number,
      ) => Promise<unknown>;
    };

    return service.finalizeLaporanKeuangan(id, user.userId);
  }
}
