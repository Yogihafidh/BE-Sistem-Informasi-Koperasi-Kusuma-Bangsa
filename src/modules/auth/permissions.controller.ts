import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Delete,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CreatePermissionDto } from './dto';
import { CurrentUser, Permissions } from '../../common/decorators';
import {
  ApiAuthErrors,
  ApiBadRequestExample,
  ApiConflictExample,
  ApiNotFoundExample,
} from '../../common/decorators/api-docs.decorator';
import { getClientIp } from '../../common/utils/request-ip.util';
import { JwtAuthGuard, PermissionsGuard } from '../../common/guards';
import type { Request } from 'express';
import type { UserFromJwt } from './interfaces/jwt-payload.interface';

@ApiTags('permissions')
@Controller('permissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionsController {
  constructor(private readonly authService: AuthService) {}

  // ==================== PERMISSION MANAGEMENT ENDPOINTS ====================
  @Post()
  @ApiBearerAuth('JWT-auth')
  @Permissions('permission.create')
  @ApiOperation({ summary: 'Buat permission baru (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Permission berhasil dibuat',
    content: {
      'application/json': {
        example: {
          message: 'Permission berhasil dibuat',
          permission: {
            id: 10,
            code: 'laporan.read',
            description: 'Read laporan',
          },
        },
      },
    },
  })
  @ApiBadRequestExample('Data tidak valid')
  @ApiAuthErrors()
  @ApiConflictExample('Permission sudah ada')
  createPermission(
    @Body() createPermissionDto: CreatePermissionDto,
    @Req() request: Request,
  ) {
    return this.authService.createPermission(
      createPermissionDto,
      getClientIp(request),
    );
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @Permissions('permission.read')
  @ApiOperation({ summary: 'Dapatkan semua permission (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Daftar permission berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil data permission',
          data: [
            {
              id: 1,
              code: 'user.read',
              description: 'Read user',
            },
            {
              id: 2,
              code: 'role.read',
              description: 'Read role',
            },
          ],
        },
      },
    },
  })
  @ApiAuthErrors()
  getAllPermissions() {
    return this.authService.getAllPermissions();
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @Permissions('permission.delete')
  @ApiOperation({ summary: 'Hapus permission (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Permission berhasil dihapus',
    content: {
      'application/json': {
        example: {
          message: 'Permission berhasil dihapus',
        },
      },
    },
  })
  @ApiAuthErrors()
  @ApiNotFoundExample('Permission tidak ditemukan')
  deletePermission(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserFromJwt,
    @Req() request: Request,
  ) {
    return this.authService.deletePermission(
      id,
      user.userId,
      getClientIp(request),
    );
  }
}
