import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SimpananService } from './simpanan.service';
import { SimpananTransaksiDto } from './dto';
import { CurrentUser, Permissions } from '../../common/decorators';
import { JwtAuthGuard, PermissionsGuard } from '../../common/guards';
import {
  ApiAuthErrors,
  ApiBadRequestExample,
  ApiNotFoundExample,
} from '../../common/decorators/api-docs.decorator';
import { validateBidirectionalPaginationParams } from '../../common/utils/pagination.util';
import type { UserFromJwt } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('simpanan')
@Controller('simpanan')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SimpananController {
  constructor(private readonly simpananService: SimpananService) {}

  @Get('nasabah/:nasabahId')
  @ApiBearerAuth('JWT-auth')
  @Permissions('simpanan.read')
  @ApiOperation({ summary: 'Dapatkan rekening simpanan nasabah' })
  @ApiResponse({
    status: 200,
    description: 'Rekening simpanan berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil rekening simpanan nasabah',
          data: [
            {
              id: 11,
              nasabahId: 1,
              jenisSimpanan: 'SUKARELA',
              saldoBerjalan: 2500000,
            },
          ],
        },
      },
    },
  })
  @ApiNotFoundExample('Nasabah tidak ditemukan')
  @ApiAuthErrors()
  listRekeningByNasabah(@Param('nasabahId', ParseIntPipe) nasabahId: number) {
    return this.simpananService.listRekeningByNasabah(nasabahId);
  }

  @Post('rekening/:id/setoran')
  @ApiBearerAuth('JWT-auth')
  @Permissions('simpanan.setor')
  @ApiOperation({
    summary: 'Catat setoran simpanan',
    description:
      'Transaksi setoran langsung diproses oleh backend hingga APPROVED/REJECTED.',
  })
  @ApiBody({ type: SimpananTransaksiDto })
  @ApiResponse({
    status: 201,
    description: 'Setoran simpanan berhasil dicatat',
    content: {
      'application/json': {
        example: {
          message: 'Transaksi berhasil diproses',
          data: {
            id: 901,
            nasabahId: 1,
            pegawaiId: 2,
            rekeningSimpananId: 11,
            jenisTransaksi: 'SETORAN',
            nominal: 200000,
            tanggal: '2026-03-10T10:00:00.000Z',
            metodePembayaran: 'TRANSFER',
          },
        },
      },
    },
  })
  @ApiBadRequestExample('Saldo simpanan tidak mencukupi')
  @ApiNotFoundExample('Rekening simpanan tidak ditemukan')
  @ApiAuthErrors()
  setoranSimpanan(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SimpananTransaksiDto,
    @CurrentUser() user: UserFromJwt,
  ) {
    return this.simpananService.setoranSimpanan(id, dto, user.userId);
  }

  @Post('rekening/:id/penarikan')
  @ApiBearerAuth('JWT-auth')
  @Permissions('simpanan.tarik')
  @ApiOperation({
    summary: 'Catat penarikan simpanan',
    description:
      'Transaksi penarikan langsung diproses oleh backend hingga APPROVED/REJECTED.',
  })
  @ApiBody({ type: SimpananTransaksiDto })
  @ApiResponse({
    status: 201,
    description: 'Penarikan simpanan berhasil dicatat',
    content: {
      'application/json': {
        example: {
          message: 'Transaksi berhasil diproses',
          data: {
            id: 902,
            nasabahId: 1,
            pegawaiId: 2,
            rekeningSimpananId: 11,
            jenisTransaksi: 'PENARIKAN',
            nominal: 100000,
            tanggal: '2026-03-10T10:30:00.000Z',
            metodePembayaran: 'TUNAI',
          },
        },
      },
    },
  })
  @ApiBadRequestExample('Saldo simpanan tidak mencukupi')
  @ApiNotFoundExample('Rekening simpanan tidak ditemukan')
  @ApiAuthErrors()
  penarikanSimpanan(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SimpananTransaksiDto,
    @CurrentUser() user: UserFromJwt,
  ) {
    return this.simpananService.penarikanSimpanan(id, dto, user.userId);
  }

  @Get('rekening/:id/transaksi')
  @ApiBearerAuth('JWT-auth')
  @Permissions('simpanan.read')
  @ApiOperation({ summary: 'Histori transaksi simpanan' })
  @ApiQuery({
    name: 'after',
    required: false,
    description:
      'Arah maju (default terbaru -> terlama). Ambil data yang lebih lama dari ID ini.',
  })
  @ApiQuery({
    name: 'before',
    required: false,
    description: 'Arah mundur. Ambil data yang lebih baru dari ID ini.',
  })
  @ApiResponse({
    status: 200,
    description: 'Histori transaksi simpanan berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil histori transaksi simpanan',
          data: [
            {
              id: 901,
              rekeningSimpananId: 11,
              jenisTransaksi: 'SETORAN',
              nominal: 200000,
              tanggal: '2026-03-10T10:00:00.000Z',
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
    return this.simpananService.listTransaksiByRekening(id, {
      after,
      before,
    });
  }

  @Delete('rekening/:id')
  @ApiBearerAuth('JWT-auth')
  @Permissions('simpanan.tarik')
  @ApiOperation({
    summary: 'Soft delete rekening simpanan',
    description:
      'Menandai rekening simpanan sebagai terhapus dengan mengisi deletedAt.',
  })
  @ApiResponse({
    status: 200,
    description: 'Rekening simpanan berhasil dihapus (soft delete)',
    content: {
      'application/json': {
        example: {
          message: 'Rekening simpanan berhasil dihapus',
        },
      },
    },
  })
  @ApiBadRequestExample('Rekening dengan saldo masih ada tidak dapat dihapus')
  @ApiNotFoundExample('Rekening simpanan tidak ditemukan')
  @ApiAuthErrors()
  softDeleteRekening(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserFromJwt,
  ) {
    return this.simpananService.softDeleteRekening(id, user.userId);
  }
}
