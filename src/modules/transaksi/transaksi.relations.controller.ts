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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TransaksiService } from './transaksi.service';
import { Permissions } from '../../common/decorators';
import { JwtAuthGuard, PermissionsGuard } from '../../common/guards';
import {
  ApiAuthErrors,
  ApiNotFoundExample,
} from '../../common/decorators/api-docs.decorator';
import { validateBidirectionalPaginationParams } from '../../common/utils/pagination.util';

@ApiTags('transaksi')
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TransaksiRelationsController {
  constructor(private readonly transaksiService: TransaksiService) {}

  @Get('rekening-simpanan/:id/transaksi')
  @ApiBearerAuth('JWT-auth')
  @Permissions('transaksi.read')
  @ApiOperation({
    summary: 'Dapatkan transaksi per rekening simpanan',
    description: 'Histori transaksi setoran/penarikan pada rekening simpanan.',
  })
  @ApiQuery({
    name: 'after',
    required: false,
    description: 'Arah maju. Ambil data setelah ID ini.',
  })
  @ApiQuery({
    name: 'before',
    required: false,
    description: 'Arah mundur. Ambil data sebelum ID ini.',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar transaksi rekening simpanan berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil data transaksi rekening simpanan',
          data: [
            {
              id: 70,
              rekeningSimpananId: 10,
              jenisTransaksi: 'SETORAN',
              nominal: 150000,
              tanggal: '2026-02-09T10:00:00.000Z',
            },
          ],
          pagination: {
            nextCursor: null,
            prevCursor: null,
            limit: 20,
            hasNext: false,
            hasPrev: false,
          },
        },
      },
    },
  })
  @ApiNotFoundExample('Rekening simpanan tidak ditemukan')
  @ApiAuthErrors()
  listTransaksiByRekening(
    @Param('id', ParseIntPipe) id: number,
    @Query('after', new ParseIntPipe({ optional: true })) after?: number,
    @Query('before', new ParseIntPipe({ optional: true })) before?: number,
  ) {
    validateBidirectionalPaginationParams(after, before);
    return this.transaksiService.listTransaksiByRekening(id, {
      after,
      before,
    });
  }

  @Get('pinjaman/:id/transaksi')
  @ApiBearerAuth('JWT-auth')
  @Permissions('transaksi.read')
  @ApiOperation({
    summary: 'Dapatkan transaksi per pinjaman',
    description: 'Histori transaksi pencairan/angsuran pada pinjaman tertentu.',
  })
  @ApiQuery({
    name: 'after',
    required: false,
    description: 'Arah maju. Ambil data setelah ID ini.',
  })
  @ApiQuery({
    name: 'before',
    required: false,
    description: 'Arah mundur. Ambil data sebelum ID ini.',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar transaksi pinjaman berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil data transaksi pinjaman',
          data: [
            {
              id: 81,
              pinjamanId: 5,
              jenisTransaksi: 'ANGSURAN',
              nominal: 300000,
              tanggal: '2026-02-09T14:00:00.000Z',
            },
          ],
          pagination: {
            nextCursor: null,
            prevCursor: null,
            limit: 20,
            hasNext: false,
            hasPrev: false,
          },
        },
      },
    },
  })
  @ApiNotFoundExample('Pinjaman tidak ditemukan')
  @ApiAuthErrors()
  listTransaksiByPinjaman(
    @Param('id', ParseIntPipe) id: number,
    @Query('after', new ParseIntPipe({ optional: true })) after?: number,
    @Query('before', new ParseIntPipe({ optional: true })) before?: number,
  ) {
    validateBidirectionalPaginationParams(after, before);
    return this.transaksiService.listTransaksiByPinjaman(id, {
      after,
      before,
    });
  }
}
