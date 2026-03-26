import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  ParseIntPipe,
  Query,
  UploadedFiles,
  UseGuards,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiQuery,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { NasabahService } from './nasabah.service';
import {
  CreateNasabahDto,
  UpdateNasabahDto,
  VerifikasiNasabahDto,
  UpdateNasabahStatusDto,
} from './dto';
import { Permissions, CurrentUser } from '../../common/decorators';
import { JwtAuthGuard, PermissionsGuard } from '../../common/guards';
import {
  ApiAuthErrors,
  ApiBadRequestExample,
  ApiConflictExample,
  ApiNotFoundExample,
} from '../../common/decorators/api-docs.decorator';
import type { Request } from 'express';
import type { UserFromJwt } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('nasabah')
@Controller('nasabah')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NasabahController {
  constructor(private readonly nasabahService: NasabahService) {}

  @Post()
  @ApiBearerAuth('JWT-auth')
  @Permissions('nasabah.create')
  @ApiOperation({ summary: 'Registrasi nasabah' })
  @ApiResponse({
    status: 201,
    description: 'Registrasi nasabah berhasil',
    content: {
      'application/json': {
        example: {
          message: 'Registrasi nasabah berhasil',
          data: {
            id: 1,
            nomorAnggota: 'AGT-20260205-1234',
            nama: 'Siti Aminah',
            nik: '3201010101010001',
            status: 'PENDING',
            statusKeterangan: 'Menunggu verifikasi pimpinan',
          },
        },
      },
    },
  })
  @ApiBadRequestExample('Data tidak valid')
  @ApiConflictExample('NIK sudah terdaftar')
  @ApiNotFoundExample('Pegawai tidak ditemukan')
  @ApiAuthErrors()
  createNasabah(
    @Body() dto: CreateNasabahDto,
    @CurrentUser() user: UserFromJwt,
    @Req() request: Request,
  ) {
    return this.nasabahService.createNasabah(dto, user.userId, request.ip);
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @Permissions('nasabah.read')
  @ApiOperation({ summary: 'Dapatkan semua nasabah' })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description:
      'ID terakhir dari halaman sebelumnya (cursor). Kosongkan untuk halaman pertama.',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar nasabah berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil data nasabah',
          data: [
            {
              id: 1,
              nomorAnggota: 'AGT-20260205-1234',
              nama: 'Siti Aminah',
              nik: '3273011201900001',
              noHp: '081234567890',
              pekerjaan: 'Wiraswasta',
              instansi: 'CV Maju Sejahtera',
              status: 'PENDING',
              tanggalDaftar: '2026-02-05T00:00:00.000Z',
            },
          ],
          pagination: {
            nextCursor: 1,
            limit: 20,
            hasNext: false,
          },
        },
      },
    },
  })
  @ApiAuthErrors()
  getAllNasabah(
    @Query('cursor', new ParseIntPipe({ optional: true })) cursor?: number,
  ) {
    return this.nasabahService.getAllNasabah(cursor);
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @Permissions('nasabah.read')
  @ApiOperation({ summary: 'Dapatkan nasabah berdasarkan ID' })
  @ApiResponse({
    status: 200,
    description: 'Nasabah berhasil ditemukan',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil data nasabah',
          data: {
            id: 1,
            nomorAnggota: 'AGT-20260205-1234',
            nama: 'Siti Aminah',
            status: 'PENDING',
            statusKeterangan: 'Menunggu verifikasi pimpinan',
          },
        },
      },
    },
  })
  @ApiNotFoundExample('Nasabah tidak ditemukan')
  @ApiAuthErrors()
  getNasabahById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserFromJwt,
  ) {
    return this.nasabahService.getNasabahById(id, user);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @Permissions('nasabah.update')
  @ApiOperation({ summary: 'Update data nasabah' })
  @ApiResponse({
    status: 200,
    description: 'Data nasabah berhasil diperbarui',
    content: {
      'application/json': {
        example: {
          message: 'Data nasabah berhasil diperbarui',
          data: {
            id: 1,
            nama: 'Siti Aminah',
            status: 'PENDING',
            statusKeterangan: 'Menunggu verifikasi pimpinan',
          },
        },
      },
    },
  })
  @ApiBadRequestExample('Data tidak valid')
  @ApiNotFoundExample('Nasabah tidak ditemukan')
  @ApiAuthErrors()
  updateNasabah(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNasabahDto,
    @CurrentUser() user: UserFromJwt,
    @Req() request: Request,
  ) {
    return this.nasabahService.updateNasabah(id, dto, user.userId, request.ip);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @Permissions('nasabah.delete')
  @ApiOperation({ summary: 'Hapus data nasabah' })
  @ApiResponse({
    status: 200,
    description: 'Nasabah berhasil dihapus',
    content: {
      'application/json': {
        example: {
          message: 'Nasabah berhasil dihapus',
        },
      },
    },
  })
  @ApiNotFoundExample('Nasabah tidak ditemukan')
  @ApiAuthErrors()
  deleteNasabah(@Param('id', ParseIntPipe) id: number) {
    return this.nasabahService.deleteNasabah(id);
  }

  @Post(':id/dokumen')
  @ApiBearerAuth('JWT-auth')
  @Permissions('nasabah.update')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        ktp: { type: 'string', format: 'binary' },
        kk: { type: 'string', format: 'binary' },
        slipGaji: { type: 'string', format: 'binary' },
      },
      required: ['ktp', 'kk'],
    },
  })
  @ApiOperation({ summary: 'Upload dokumen nasabah' })
  @ApiResponse({
    status: 201,
    description: 'Upload dokumen berhasil',
    content: {
      'application/json': {
        example: {
          message: 'Upload dokumen berhasil',
          data: [
            {
              id: 1,
              nasabahId: 1,
              jenisDokumen: 'KTP',
              fileUrl: 'http://localhost:9000/ktp/nasabah/1/ktp.png',
              uploadedAt: '2026-02-05T10:10:00.000Z',
            },
            {
              id: 2,
              nasabahId: 1,
              jenisDokumen: 'KK',
              fileUrl: 'http://localhost:9000/kk/nasabah/1/kk.png',
              uploadedAt: '2026-02-05T10:10:00.000Z',
            },
          ],
        },
      },
    },
  })
  @ApiBadRequestExample('File tidak valid')
  @ApiNotFoundExample('Nasabah tidak ditemukan')
  @ApiAuthErrors()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'ktp', maxCount: 1 },
      { name: 'kk', maxCount: 1 },
      { name: 'slipGaji', maxCount: 1 },
    ]),
  )
  uploadDokumen(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserFromJwt,
    @UploadedFiles()
    files: {
      ktp?: {
        buffer: Buffer;
        originalname: string;
        mimetype: string;
        size: number;
      }[];
      kk?: {
        buffer: Buffer;
        originalname: string;
        mimetype: string;
        size: number;
      }[];
      slipGaji?: {
        buffer: Buffer;
        originalname: string;
        mimetype: string;
        size: number;
      }[];
    },
  ) {
    return this.nasabahService.uploadDokumen(id, files, user);
  }

  @Patch(':id/verifikasi')
  @ApiBearerAuth('JWT-auth')
  @Permissions('nasabah.verify')
  @ApiOperation({
    summary: 'Verifikasi nasabah',
    description:
      'Pilihan input: status AKTIF (menyetujui) atau DITOLAK (menolak). Status awal registrasi adalah PENDING.',
  })
  @ApiBody({
    description: 'Isi status verifikasi dan catatan opsional.',
    type: VerifikasiNasabahDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Verifikasi nasabah berhasil',
    content: {
      'application/json': {
        example: {
          message: 'Verifikasi nasabah berhasil',
          data: {
            id: 1,
            status: 'AKTIF',
            statusKeterangan: 'Nasabah aktif dan dapat bertransaksi',
          },
        },
      },
    },
  })
  @ApiBadRequestExample('Status verifikasi tidak valid')
  @ApiNotFoundExample('Nasabah tidak ditemukan')
  @ApiAuthErrors()
  verifikasiNasabah(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VerifikasiNasabahDto,
    @CurrentUser() user: UserFromJwt,
    @Req() request: Request,
  ) {
    return this.nasabahService.verifikasiNasabah(
      id,
      dto,
      user.userId,
      request.ip,
    );
  }

  @Patch(':id/status')
  @ApiBearerAuth('JWT-auth')
  @Permissions('nasabah.update')
  @ApiOperation({
    summary: 'Ubah status keanggotaan nasabah',
    description:
      'Pilihan input: status AKTIF (aktif kembali) atau NONAKTIF (nasabah keluar/tidak aktif).',
  })
  @ApiBody({
    description: 'Isi status keanggotaan.',
    type: UpdateNasabahStatusDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Status nasabah berhasil diperbarui',
    content: {
      'application/json': {
        example: {
          message: 'Status nasabah berhasil diperbarui',
          data: {
            id: 1,
            status: 'NONAKTIF',
          },
        },
      },
    },
  })
  @ApiBadRequestExample('Status keanggotaan tidak valid')
  @ApiNotFoundExample('Nasabah tidak ditemukan')
  @ApiAuthErrors()
  updateStatusNasabah(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNasabahStatusDto,
    @CurrentUser() user: UserFromJwt,
    @Req() request: Request,
  ) {
    return this.nasabahService.updateStatusNasabah(
      id,
      dto,
      user.userId,
      request.ip,
    );
  }
}
