import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  ParseIntPipe,
  ParseEnumPipe,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiParam,
  ApiQuery,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { JenisDokumen, NasabahStatus } from '@prisma/client';
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
    name: 'after',
    required: false,
    description: 'Cursor maju. Ambil data setelah ID ini.',
  })
  @ApiQuery({
    name: 'before',
    required: false,
    description: 'Cursor mundur. Ambil data sebelum ID ini.',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description:
      'Alias legacy untuk after. Tetap didukung agar backward-compatible.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: NasabahStatus,
    description: 'Filter status nasabah (contoh: PENDING, AKTIF, DITOLAK)',
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
  getAllNasabah(
    @Query('after', new ParseIntPipe({ optional: true })) after?: number,
    @Query('before', new ParseIntPipe({ optional: true })) before?: number,
    @Query('cursor', new ParseIntPipe({ optional: true })) cursor?: number,
    @Query('status', new ParseEnumPipe(NasabahStatus, { optional: true }))
    status?: NasabahStatus,
  ) {
    const effectiveAfter = after ?? cursor;
    return this.nasabahService.getAllNasabah(
      { after: effectiveAfter, before },
      status,
    );
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
            id: 97,
            userId: null,
            pegawaiId: 125,
            nomorAnggota: 'AGT-20260310-3079',
            nama: 'Yono Sebastian',
            nik: '3201010101010007',
            alamat: 'Jl. Kenanga No. TEST, Bandung',
            noHp: '081234567890',
            pekerjaan: 'Wiraswasta',
            instansi: 'PT Maju Jaya',
            penghasilanBulanan: '6000000',
            tanggalLahir: '1995-08-17T00:00:00.000Z',
            tanggalDaftar: '2026-02-05T00:00:00.000Z',
            status: 'AKTIF',
            catatan: 'Dokumen valid',
            createdAt: '2026-03-10T07:36:39.731Z',
            updatedAt: '2026-03-10T07:40:31.441Z',
            deletedAt: null,
            pegawai: {
              id: 125,
              nama: 'Yogi Hafidh Maulana',
              jabatan: 'Direktur Keuangan',
            },
            user: null,
            dokumen: [
              {
                id: 5,
                nasabahId: 97,
                jenisDokumen: 'KTP',
                fileUrl:
                  'http://localhost:9000/ktp-docs/nasabah/97/ktp-1773128418963-file.png?X-Amz-Algorithm=AWS4-HMAC-SHA256',
                uploadedAt: '2026-03-10T07:40:19.023Z',
              },
              {
                id: 6,
                nasabahId: 97,
                jenisDokumen: 'KK',
                fileUrl:
                  'http://localhost:9000/kk-docs/nasabah/97/kk-1773128419027-file.png?X-Amz-Algorithm=AWS4-HMAC-SHA256',
                uploadedAt: '2026-03-10T07:40:19.081Z',
              },
            ],
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
              fileUrl:
                'http://localhost:9000/ktp-docs/nasabah/1/ktp-1773128418963-file.png?X-Amz-Algorithm=AWS4-HMAC-SHA256',
              uploadedAt: '2026-02-05T10:10:00.000Z',
            },
            {
              id: 2,
              nasabahId: 1,
              jenisDokumen: 'KK',
              fileUrl:
                'http://localhost:9000/kk-docs/nasabah/1/kk-1773128419027-file.png?X-Amz-Algorithm=AWS4-HMAC-SHA256',
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

  @Patch(':id/dokumen/:jenisDokumen')
  @ApiBearerAuth('JWT-auth')
  @Permissions('nasabah.update')
  @ApiConsumes('multipart/form-data')
  @ApiParam({
    name: 'jenisDokumen',
    enum: JenisDokumen,
    description: 'Jenis dokumen yang ingin diperbarui',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiOperation({
    summary: 'Update dokumen nasabah per jenis',
    description:
      'Upload file baru, hapus file lama di storage, lalu perbarui referensi dokumen di database.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dokumen nasabah berhasil diperbarui',
    content: {
      'application/json': {
        example: {
          message: 'Dokumen nasabah berhasil diperbarui',
          data: {
            id: 5,
            nasabahId: 97,
            jenisDokumen: 'KTP',
            fileUrl:
              'http://localhost:9000/ktp-docs/nasabah/97/ktp-1773128418963-file.png?X-Amz-Algorithm=AWS4-HMAC-SHA256',
            uploadedAt: '2026-03-26T14:19:15.000Z',
          },
        },
      },
    },
  })
  @ApiBadRequestExample('File tidak valid')
  @ApiNotFoundExample('Nasabah tidak ditemukan')
  @ApiAuthErrors()
  @UseInterceptors(FileInterceptor('file'))
  updateDokumenNasabah(
    @Param('id', ParseIntPipe) id: number,
    @Param('jenisDokumen', new ParseEnumPipe(JenisDokumen))
    jenisDokumen: JenisDokumen,
    @CurrentUser() user: UserFromJwt,
    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
  ) {
    return this.nasabahService.updateDokumenNasabah(
      id,
      jenisDokumen,
      file,
      user,
    );
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
