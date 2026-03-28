import {
  Controller,
  Delete,
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
import { JenisTransaksi } from '@prisma/client';
import { TransaksiService } from './transaksi.service';
import { Permissions } from '../../common/decorators';
import { JwtAuthGuard, PermissionsGuard } from '../../common/guards';
import {
  ApiAuthErrors,
  ApiNotFoundExample,
} from '../../common/decorators/api-docs.decorator';
import { validateBidirectionalPaginationParams } from '../../common/utils/pagination.util';

@ApiTags('transaksi')
@Controller('transaksi')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TransaksiController {
  constructor(private readonly transaksiService: TransaksiService) {}

  @Get()
  @ApiBearerAuth('JWT-auth')
  @Permissions('transaksi.read')
  @ApiOperation({
    summary: 'Dapatkan daftar transaksi',
    description:
      'Mendukung pagination dua arah dan filter jenis serta rentang tanggal.',
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
  @ApiQuery({
    name: 'jenisTransaksi',
    required: false,
    enum: JenisTransaksi,
    description: 'Filter jenis transaksi',
  })
  @ApiQuery({
    name: 'tanggalFrom',
    required: false,
    description: 'Filter tanggal mulai (ISO string)',
  })
  @ApiQuery({
    name: 'tanggalTo',
    required: false,
    description: 'Filter tanggal akhir (ISO string)',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar transaksi berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil data transaksi',
          data: [
            {
              id: 12,
              nasabahId: 1,
              pegawaiId: 2,
              rekeningSimpananId: 10,
              jenisTransaksi: 'SETORAN',
              nominal: 150000,
              tanggal: '2026-02-09T10:00:00.000Z',
              metodePembayaran: 'TRANSFER',
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
  @ApiAuthErrors()
  listTransaksi(
    @Query('after', new ParseIntPipe({ optional: true })) after?: number,
    @Query('before', new ParseIntPipe({ optional: true })) before?: number,
    @Query('jenisTransaksi') jenisTransaksi?: JenisTransaksi,
    @Query('tanggalFrom') tanggalFrom?: string,
    @Query('tanggalTo') tanggalTo?: string,
  ) {
    validateBidirectionalPaginationParams(after, before);
    return this.transaksiService.listTransaksi({
      after,
      before,
      jenisTransaksi,
      tanggalFrom,
      tanggalTo,
    });
  }

  @Get('nasabah/:nasabahId')
  @ApiBearerAuth('JWT-auth')
  @Permissions('transaksi.read')
  @ApiOperation({
    summary: 'Dapatkan transaksi per nasabah',
    description: 'Histori transaksi milik nasabah tertentu.',
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
    description: 'Daftar transaksi nasabah berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil data transaksi nasabah',
          data: [
            {
              id: 21,
              nasabahId: 1,
              jenisTransaksi: 'PENARIKAN',
              nominal: 50000,
              tanggal: '2026-02-09T12:00:00.000Z',
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
  @ApiAuthErrors()
  listTransaksiByNasabah(
    @Param('nasabahId', ParseIntPipe) nasabahId: number,
    @Query('after', new ParseIntPipe({ optional: true })) after?: number,
    @Query('before', new ParseIntPipe({ optional: true })) before?: number,
  ) {
    validateBidirectionalPaginationParams(after, before);
    return this.transaksiService.listTransaksiByNasabah(nasabahId, {
      after,
      before,
    });
  }

  @Get('pegawai/:pegawaiId')
  @ApiBearerAuth('JWT-auth')
  @Permissions('transaksi.read')
  @ApiOperation({
    summary: 'Dapatkan transaksi per pegawai',
    description: 'Histori transaksi yang dicatat oleh pegawai tertentu.',
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
    description: 'Daftar transaksi pegawai berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil data transaksi pegawai',
          data: [
            {
              id: 30,
              pegawaiId: 2,
              jenisTransaksi: 'SETORAN',
              nominal: 200000,
              tanggal: '2026-02-09T13:00:00.000Z',
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
  @ApiAuthErrors()
  listTransaksiByPegawai(
    @Param('pegawaiId', ParseIntPipe) pegawaiId: number,
    @Query('after', new ParseIntPipe({ optional: true })) after?: number,
    @Query('before', new ParseIntPipe({ optional: true })) before?: number,
  ) {
    validateBidirectionalPaginationParams(after, before);
    return this.transaksiService.listTransaksiByPegawai(pegawaiId, {
      after,
      before,
    });
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @Permissions('transaksi.read')
  @ApiOperation({
    summary: 'Dapatkan detail transaksi',
    description:
      'Detail lengkap transaksi termasuk relasi nasabah dan pegawai.',
  })
  @ApiResponse({
    status: 200,
    description: 'Detail transaksi berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil detail transaksi',
          data: {
            id: 1,
            nasabahId: 1,
            pegawaiId: 2,
            jenisTransaksi: 'SETORAN',
            nominal: 150000,
            tanggal: '2026-02-09T10:00:00.000Z',
            metodePembayaran: 'TRANSFER',
          },
        },
      },
    },
  })
  @ApiNotFoundExample('Transaksi tidak ditemukan')
  @ApiAuthErrors()
  getTransaksiById(@Param('id', ParseIntPipe) id: number) {
    return this.transaksiService.getTransaksiById(id);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @Permissions('transaksi.process')
  @ApiOperation({
    summary: 'Soft delete transaksi',
    description:
      'Menandai transaksi sebagai terhapus dengan mengisi deletedAt.',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaksi berhasil dihapus (soft delete)',
    content: {
      'application/json': {
        example: {
          message: 'Transaksi berhasil dihapus',
        },
      },
    },
  })
  @ApiNotFoundExample('Transaksi tidak ditemukan')
  @ApiAuthErrors()
  softDeleteTransaksi(@Param('id', ParseIntPipe) id: number) {
    return this.transaksiService.softDeleteTransaksi(id);
  }
}
