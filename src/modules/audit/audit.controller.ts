import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { AuditAction } from '@prisma/client';
import { Permissions } from '../../common/decorators';
import { JwtAuthGuard, PermissionsGuard } from '../../common/guards';
import { ApiAuthErrors } from '../../common/decorators/api-docs.decorator';
import { AuditTrailService } from './audit.service';
import { ListAuditTrailQueryDto } from './dto/list-audit-trail-query.dto';

@ApiTags('audit')
@Controller('audit-trails')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditTrailService: AuditTrailService) {}

  @Get()
  @ApiBearerAuth('JWT-auth')
  @Permissions('audit.read')
  @ApiOperation({
    summary: 'Dapatkan daftar audit trail',
    description:
      'Mendukung pagination dan filter berdasarkan aksi, entitas, user, serta rentang waktu.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'action', required: false, enum: AuditAction })
  @ApiQuery({ name: 'userId', required: false, example: 1 })
  @ApiQuery({
    name: 'fromDate',
    required: false,
    description: 'ISO datetime, contoh: 2026-03-07T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'toDate',
    required: false,
    description: 'ISO datetime, contoh: 2026-03-07T23:59:59.999Z',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar audit trail berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil data audit trail',
          data: [
            {
              id: 'c5e5b4db-8f8a-4cae-bb92-fd1c7a0f3b44',
              action: 'UPDATE',
              entityName: 'Nasabah',
              entityId: 1,
              userId: 2,
              createdAt: '2026-03-10T08:00:00.000Z',
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrev: false,
          },
        },
      },
    },
  })
  @ApiAuthErrors()
  listAuditTrails(@Query() query: ListAuditTrailQueryDto) {
    return this.auditTrailService.listAuditTrails(query);
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @Permissions('audit.read')
  @ApiOperation({ summary: 'Dapatkan detail audit trail berdasarkan ID' })
  @ApiResponse({
    status: 200,
    description: 'Detail audit trail berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil detail audit trail',
          data: {
            id: 'c5e5b4db-8f8a-4cae-bb92-fd1c7a0f3b44',
            action: 'UPDATE',
            entityName: 'Nasabah',
            entityId: 1,
            userId: 2,
            oldValue: { status: 'PENDING' },
            newValue: { status: 'AKTIF' },
            createdAt: '2026-03-10T08:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiAuthErrors()
  getAuditTrailById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.auditTrailService.getAuditTrailById(id);
  }
}
