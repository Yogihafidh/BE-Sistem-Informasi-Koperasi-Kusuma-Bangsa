import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PinjamanService } from './pinjaman.service';
import {
  AngsuranPinjamanDto,
  CreatePinjamanDto,
  PencairanPinjamanDto,
  VerifikasiPinjamanDto,
} from './dto';
import { CurrentUser, Permissions } from '../../common/decorators';
import { JwtAuthGuard, PermissionsGuard } from '../../common/guards';
import {
  ApiAuthErrors,
  ApiBadRequestExample,
  ApiNotFoundExample,
} from '../../common/decorators/api-docs.decorator';
import type { UserFromJwt } from '../auth/interfaces/jwt-payload.interface';
import type { Request } from 'express';

@ApiTags('pinjaman')
@Controller('pinjaman')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PinjamanController {
  constructor(private readonly pinjamanService: PinjamanService) {}

  @Post()
  @ApiBearerAuth('JWT-auth')
  @Permissions('pinjaman.ajukan')
  @ApiOperation({
    summary: 'Pengajuan pinjaman',
    description:
      'Bunga pinjaman tidak dikirim dari request. Nilai bungaPersen otomatis diambil dari settings koperasi (loan.defaultInterestPercent) dan disimpan sebagai snapshot ke data pinjaman saat create.',
  })
  @ApiBody({
    type: CreatePinjamanDto,
    examples: {
      default: {
        summary: 'Contoh pengajuan pinjaman',
        value: {
          nasabahId: 1,
          jumlahPinjaman: 5000000,
          tenorBulan: 12,
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Pengajuan pinjaman berhasil dibuat',
    content: {
      'application/json': {
        example: {
          message: 'Pengajuan pinjaman berhasil dibuat',
          data: {
            id: 101,
            nasabahId: 1,
            jumlahPinjaman: 5000000,
            bungaPersen: 1.5,
            tenorBulan: 12,
            sisaPinjaman: 0,
            status: 'PENDING',
            verifiedById: null,
            tanggalPersetujuan: null,
          },
        },
      },
    },
  })
  @ApiBadRequestExample('Nasabah tidak aktif')
  @ApiNotFoundExample('Nasabah tidak ditemukan')
  @ApiAuthErrors()
  createPinjaman(
    @Body() dto: CreatePinjamanDto,
    @CurrentUser() user: UserFromJwt,
    @Req() request: Request,
  ) {
    return this.pinjamanService.createPinjaman(dto, user.userId, request.ip);
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @Permissions('pinjaman.read')
  @ApiOperation({ summary: 'Dapatkan detail pinjaman' })
  @ApiResponse({
    status: 200,
    description: 'Detail pinjaman berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil detail pinjaman',
          data: {
            id: 101,
            nasabahId: 1,
            jumlahPinjaman: 5000000,
            bungaPersen: 1.5,
            tenorBulan: 12,
            sisaPinjaman: 5000000,
            status: 'DISETUJUI',
            verifiedById: 2,
            tanggalPersetujuan: '2026-03-10T08:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiNotFoundExample('Pinjaman tidak ditemukan')
  @ApiAuthErrors()
  getPinjamanById(@Param('id', ParseIntPipe) id: number) {
    return this.pinjamanService.getPinjamanById(id);
  }

  @Get('nasabah/:nasabahId')
  @ApiBearerAuth('JWT-auth')
  @Permissions('pinjaman.read')
  @ApiOperation({ summary: 'Dapatkan pinjaman per nasabah' })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description:
      'ID terakhir dari halaman sebelumnya (cursor). Kosongkan untuk halaman pertama.',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar pinjaman nasabah berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil data pinjaman nasabah',
          data: [
            {
              id: 101,
              nasabahId: 1,
              jumlahPinjaman: 5000000,
              tenorBulan: 12,
              status: 'DISETUJUI',
              sisaPinjaman: 3500000,
            },
          ],
          pagination: {
            nextCursor: null,
            limit: 20,
            hasNext: false,
          },
        },
      },
    },
  })
  @ApiAuthErrors()
  listPinjamanByNasabah(
    @Param('nasabahId', ParseIntPipe) nasabahId: number,
    @Query('cursor', new ParseIntPipe({ optional: true })) cursor?: number,
  ) {
    return this.pinjamanService.listPinjamanByNasabah(nasabahId, cursor);
  }

  @Patch(':id/verifikasi')
  @ApiBearerAuth('JWT-auth')
  @Permissions('pinjaman.verify')
  @ApiOperation({ summary: 'Verifikasi pinjaman' })
  @ApiBody({ type: VerifikasiPinjamanDto })
  @ApiResponse({
    status: 200,
    description: 'Verifikasi pinjaman berhasil',
    content: {
      'application/json': {
        example: {
          message: 'Verifikasi pinjaman berhasil',
          data: {
            id: 101,
            status: 'DISETUJUI',
            verifiedById: 2,
            tanggalPersetujuan: '2026-03-10T08:30:00.000Z',
          },
        },
      },
    },
  })
  @ApiBadRequestExample('Status verifikasi tidak valid')
  @ApiNotFoundExample('Pinjaman tidak ditemukan')
  @ApiAuthErrors()
  verifikasiPinjaman(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VerifikasiPinjamanDto,
    @CurrentUser() user: UserFromJwt,
    @Req() request: Request,
  ) {
    return this.pinjamanService.verifikasiPinjaman(
      id,
      dto,
      user.userId,
      request.ip,
    );
  }

  @Post(':id/pencairan')
  @ApiBearerAuth('JWT-auth')
  @Permissions('pinjaman.cairkan')
  @ApiOperation({
    summary: 'Catat pencairan pinjaman',
    description:
      'Transaksi pencairan langsung diproses oleh backend hingga APPROVED/REJECTED.',
  })
  @ApiBody({ type: PencairanPinjamanDto })
  @ApiResponse({
    status: 201,
    description: 'Pencairan pinjaman berhasil dicatat',
    content: {
      'application/json': {
        example: {
          message: 'Transaksi berhasil diproses',
          data: {
            id: 801,
            nasabahId: 1,
            pegawaiId: 2,
            pinjamanId: 101,
            jenisTransaksi: 'PENCAIRAN',
            nominal: 5000000,
            tanggal: '2026-03-10T09:00:00.000Z',
            metodePembayaran: 'TRANSFER',
          },
        },
      },
    },
  })
  @ApiBadRequestExample('Pencairan pinjaman sudah dibuat')
  @ApiNotFoundExample('Pinjaman tidak ditemukan')
  @ApiAuthErrors()
  pencairanPinjaman(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PencairanPinjamanDto,
    @CurrentUser() user: UserFromJwt,
  ) {
    return this.pinjamanService.pencairanPinjaman(id, dto, user.userId);
  }

  @Post(':id/angsuran')
  @ApiBearerAuth('JWT-auth')
  @Permissions('pinjaman.angsuran')
  @ApiOperation({
    summary: 'Catat angsuran pinjaman',
    description:
      'Transaksi angsuran langsung diproses oleh backend hingga APPROVED/REJECTED.',
  })
  @ApiBody({ type: AngsuranPinjamanDto })
  @ApiResponse({
    status: 201,
    description: 'Angsuran pinjaman berhasil dicatat',
    content: {
      'application/json': {
        example: {
          message: 'Transaksi berhasil diproses',
          data: {
            id: 802,
            nasabahId: 1,
            pegawaiId: 2,
            pinjamanId: 101,
            jenisTransaksi: 'ANGSURAN',
            nominal: 500000,
            tanggal: '2026-03-10T09:30:00.000Z',
            metodePembayaran: 'TUNAI',
          },
        },
      },
    },
  })
  @ApiBadRequestExample('Nominal melebihi sisa pinjaman')
  @ApiNotFoundExample('Pinjaman tidak ditemukan')
  @ApiAuthErrors()
  angsuranPinjaman(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AngsuranPinjamanDto,
    @CurrentUser() user: UserFromJwt,
  ) {
    return this.pinjamanService.angsuranPinjaman(id, dto, user.userId);
  }

  @Get(':id/transaksi')
  @ApiBearerAuth('JWT-auth')
  @Permissions('pinjaman.read')
  @ApiOperation({ summary: 'Histori transaksi pinjaman' })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description:
      'ID terakhir dari halaman sebelumnya (cursor). Kosongkan untuk halaman pertama.',
  })
  @ApiResponse({
    status: 200,
    description: 'Histori transaksi pinjaman berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil histori transaksi pinjaman',
          data: [
            {
              id: 801,
              pinjamanId: 101,
              jenisTransaksi: 'PENCAIRAN',
              nominal: 5000000,
              tanggal: '2026-03-10T09:00:00.000Z',
            },
            {
              id: 802,
              pinjamanId: 101,
              jenisTransaksi: 'ANGSURAN',
              nominal: 500000,
              tanggal: '2026-03-10T09:30:00.000Z',
            },
          ],
          pagination: {
            nextCursor: null,
            limit: 20,
            hasNext: false,
          },
        },
      },
    },
  })
  @ApiNotFoundExample('Pinjaman tidak ditemukan')
  @ApiAuthErrors()
  listTransaksiByPinjaman(
    @Param('id', ParseIntPipe) id: number,
    @Query('cursor', new ParseIntPipe({ optional: true })) cursor?: number,
  ) {
    return this.pinjamanService.listTransaksiByPinjaman(id, cursor);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @Permissions('pinjaman.verify')
  @ApiOperation({
    summary: 'Soft delete pinjaman',
    description: 'Menandai pinjaman sebagai terhapus dengan mengisi deletedAt.',
  })
  @ApiResponse({
    status: 200,
    description: 'Pinjaman berhasil dihapus (soft delete)',
    content: {
      'application/json': {
        example: {
          message: 'Pinjaman berhasil dihapus',
        },
      },
    },
  })
  @ApiNotFoundExample('Pinjaman tidak ditemukan')
  @ApiAuthErrors()
  softDeletePinjaman(@Param('id', ParseIntPipe) id: number) {
    return this.pinjamanService.softDeletePinjaman(id);
  }
}
