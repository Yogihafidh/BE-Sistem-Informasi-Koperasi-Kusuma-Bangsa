import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  ParseIntPipe,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiQuery,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PegawaiService } from './pegawai.service';
import {
  CreatePegawaiDto,
  UpdatePegawaiDto,
  TogglePegawaiStatusDto,
} from './dto';
import { CurrentUser, Permissions } from '../../common/decorators';
import { JwtAuthGuard, PermissionsGuard } from '../../common/guards';
import {
  ApiAuthErrors,
  ApiBadRequestExample,
  ApiConflictExample,
  ApiNotFoundExample,
} from '../../common/decorators/api-docs.decorator';
import { getClientIp } from '../../common/utils/request-ip.util';
import { validateBidirectionalPaginationParams } from '../../common/utils/pagination.util';
import type { Request } from 'express';
import type { UserFromJwt } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('pegawai')
@Controller('pegawai')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PegawaiController {
  constructor(private readonly pegawaiService: PegawaiService) {}

  @Post()
  @ApiBearerAuth('JWT-auth')
  @Permissions('pegawai.create')
  @ApiOperation({ summary: 'Buat data pegawai' })
  @ApiResponse({
    status: 201,
    description: 'Pegawai berhasil dibuat',
    content: {
      'application/json': {
        example: {
          message: 'Pegawai berhasil dibuat',
          data: {
            id: 1,
            userId: 2,
            nama: 'Budi Santoso',
            jabatan: 'Kasir',
            noHp: '081234567890',
            alamat: 'Jl. Melati No. 10, Bandung',
            statusAktif: true,
            createdAt: '2026-02-05T10:00:00.000Z',
            user: {
              id: 2,
              username: 'kasir1',
              email: 'kasir1@koperasi.com',
            },
          },
        },
      },
    },
  })
  @ApiBadRequestExample('Data tidak valid')
  @ApiConflictExample('User sudah terdaftar sebagai pegawai')
  @ApiNotFoundExample('User tidak ditemukan')
  @ApiAuthErrors()
  createPegawai(
    @Body() dto: CreatePegawaiDto,
    @CurrentUser() user: UserFromJwt,
    @Req() request: Request,
  ) {
    return this.pegawaiService.createPegawai(
      dto,
      user.userId,
      getClientIp(request),
    );
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @Permissions('pegawai.read')
  @ApiOperation({ summary: 'Dapatkan semua pegawai' })
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
    description: 'Daftar pegawai berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil data pegawai',
          data: [
            {
              id: 1,
              userId: 2,
              nama: 'Budi Santoso',
              jabatan: 'Kasir',
              noHp: '081234567890',
              alamat: 'Jl. Melati No. 10, Bandung',
              statusAktif: true,
            },
          ],
          pagination: {
            nextCursor: 1,
            prevCursor: 20,
            limit: 20,
            hasNext: true,
            hasPrev: true,
          },
        },
      },
    },
  })
  @ApiAuthErrors()
  getAllPegawai(
    @Query('after', new ParseIntPipe({ optional: true })) after?: number,
    @Query('before', new ParseIntPipe({ optional: true })) before?: number,
  ) {
    validateBidirectionalPaginationParams(after, before);
    return this.pegawaiService.getAllPegawai({
      after,
      before,
    });
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @Permissions('pegawai.read')
  @ApiOperation({ summary: 'Dapatkan pegawai berdasarkan ID' })
  @ApiResponse({
    status: 200,
    description: 'Pegawai berhasil ditemukan',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil data pegawai',
          data: {
            id: 1,
            userId: 2,
            nama: 'Budi Santoso',
            jabatan: 'Kasir',
            noHp: '081234567890',
            alamat: 'Jl. Melati No. 10, Bandung',
            statusAktif: true,
            createdAt: '2026-02-05T10:00:00.000Z',
            user: {
              id: 2,
              username: 'kasir1',
              email: 'kasir1@koperasi.com',
            },
          },
        },
      },
    },
  })
  @ApiNotFoundExample('Pegawai tidak ditemukan')
  @ApiAuthErrors()
  getPegawaiById(@Param('id', ParseIntPipe) id: number) {
    return this.pegawaiService.getPegawaiById(id);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @Permissions('pegawai.update')
  @ApiOperation({ summary: 'Update data pegawai' })
  @ApiResponse({
    status: 200,
    description: 'Pegawai berhasil diperbarui',
    content: {
      'application/json': {
        example: {
          message: 'Pegawai berhasil diperbarui',
          data: {
            id: 1,
            userId: 2,
            nama: 'Budi Santoso',
            jabatan: 'Kasir Senior',
            noHp: '081234567890',
            alamat: 'Jl. Melati No. 10, Bandung',
            statusAktif: true,
            createdAt: '2026-02-05T10:00:00.000Z',
            user: {
              id: 2,
              username: 'kasir1',
              email: 'kasir1@koperasi.com',
            },
          },
        },
      },
    },
  })
  @ApiBadRequestExample('Data tidak valid')
  @ApiNotFoundExample('Pegawai tidak ditemukan')
  @ApiAuthErrors()
  updatePegawai(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePegawaiDto,
    @CurrentUser() user: UserFromJwt,
    @Req() request: Request,
  ) {
    return this.pegawaiService.updatePegawai(
      id,
      dto,
      user.userId,
      getClientIp(request),
    );
  }

  @Patch(':id/status')
  @ApiBearerAuth('JWT-auth')
  @Permissions('pegawai.update')
  @ApiOperation({ summary: 'Aktifkan atau nonaktifkan pegawai' })
  @ApiResponse({
    status: 200,
    description: 'Status pegawai berhasil diperbarui',
    content: {
      'application/json': {
        example: {
          message: 'Status pegawai berhasil diperbarui',
          data: {
            id: 1,
            userId: 2,
            nama: 'Budi Santoso',
            jabatan: 'Kasir',
            noHp: '081234567890',
            alamat: 'Jl. Melati No. 10, Bandung',
            statusAktif: false,
            createdAt: '2026-02-05T10:00:00.000Z',
            user: {
              id: 2,
              username: 'kasir1',
              email: 'kasir1@koperasi.com',
            },
          },
        },
      },
    },
  })
  @ApiBadRequestExample('Data tidak valid')
  @ApiNotFoundExample('Pegawai tidak ditemukan')
  @ApiAuthErrors()
  updatePegawaiStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TogglePegawaiStatusDto,
    @CurrentUser() user: UserFromJwt,
    @Req() request: Request,
  ) {
    return this.pegawaiService.updatePegawaiStatus(
      id,
      dto,
      user.userId,
      getClientIp(request),
    );
  }
}
