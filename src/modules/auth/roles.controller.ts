import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
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
import { AssignPermissionsDto, CreateRoleDto, UpdateRoleDto } from './dto';
import { CurrentUser, Permissions } from '../../common/decorators';
import {
  ApiAuthErrors,
  ApiBadRequestExample,
  ApiConflictExample,
  ApiNotFoundExample,
} from '../../common/decorators/api-docs.decorator';
import { JwtAuthGuard, PermissionsGuard } from '../../common/guards';
import type { Request } from 'express';
import type { UserFromJwt } from './interfaces/jwt-payload.interface';

@ApiTags('roles')
@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly authService: AuthService) {}

  // ==================== ROLE MANAGEMENT ENDPOINTS ====================
  @Post()
  @ApiBearerAuth('JWT-auth')
  @Permissions('role.create')
  @ApiOperation({ summary: 'Buat role baru (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Role berhasil dibuat',
    content: {
      'application/json': {
        example: {
          message: 'Role berhasil dibuat',
          role: {
            id: 5,
            name: 'Supervisor',
            description: 'Supervisor operasional',
          },
        },
      },
    },
  })
  @ApiBadRequestExample('Data tidak valid')
  @ApiAuthErrors()
  @ApiConflictExample('Role sudah ada')
  createRole(@Body() createRoleDto: CreateRoleDto, @Req() request: Request) {
    return this.authService.createRole(createRoleDto, request.ip);
  }

  @Get()
  @ApiBearerAuth('JWT-auth')
  @Permissions('role.read')
  @ApiOperation({ summary: 'Dapatkan semua role (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Daftar role berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil data role',
          data: [
            {
              id: 1,
              name: 'Admin',
              description: 'Administrator dengan akses penuh',
              totalUsers: 1,
            },
            {
              id: 2,
              name: 'Kasir',
              description: 'Kasir yang menangani transaksi harian',
              totalUsers: 0,
            },
          ],
        },
      },
    },
  })
  @ApiAuthErrors()
  getAllRoles() {
    return this.authService.getAllRoles();
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @Permissions('role.read')
  @ApiOperation({ summary: 'Dapatkan role berdasarkan ID (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Role berhasil ditemukan',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil detail role',
          data: {
            id: 1,
            name: 'Admin',
            description: 'Administrator dengan akses penuh',
            permissions: [
              'user.create',
              'user.read',
              'role.read',
              'dashboard.read',
            ],
            users: [
              {
                id: 1,
                username: 'admin',
                email: 'admin@koperasi.com',
              },
            ],
          },
        },
      },
    },
  })
  @ApiAuthErrors()
  @ApiNotFoundExample('Role tidak ditemukan')
  getRoleById(@Param('id', ParseIntPipe) id: number) {
    return this.authService.getRoleById(id);
  }

  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @Permissions('role.update')
  @ApiOperation({ summary: 'Update role (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Role berhasil diupdate',
    content: {
      'application/json': {
        example: {
          message: 'Role berhasil diperbarui',
          role: {
            id: 2,
            name: 'Kasir Senior',
            description: 'Kasir dengan akses tambahan',
          },
        },
      },
    },
  })
  @ApiBadRequestExample('Data tidak valid')
  @ApiAuthErrors()
  @ApiNotFoundExample('Role tidak ditemukan')
  updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoleDto: UpdateRoleDto,
    @Req() request: Request,
  ) {
    return this.authService.updateRole(id, updateRoleDto, request.ip);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @Permissions('role.delete')
  @ApiOperation({ summary: 'Hapus role (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Role berhasil dihapus',
    content: {
      'application/json': {
        example: {
          message: 'Role berhasil dihapus',
        },
      },
    },
  })
  @ApiAuthErrors()
  @ApiNotFoundExample('Role tidak ditemukan')
  deleteRole(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserFromJwt,
    @Req() request: Request,
  ) {
    return this.authService.deleteRole(id, user.userId, request.ip);
  }

  // ==================== ROLE-PERMISSION ASSIGNMENT ENDPOINTS ====================
  @Post(':id/permissions')
  @ApiBearerAuth('JWT-auth')
  @Permissions('role.update')
  @ApiOperation({ summary: 'Assign permissions ke role (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Permissions berhasil di-assign ke role',
    content: {
      'application/json': {
        example: {
          message: 'Permission berhasil di-assign ke role',
        },
      },
    },
  })
  @ApiBadRequestExample('Data tidak valid')
  @ApiAuthErrors()
  @ApiNotFoundExample('Role tidak ditemukan')
  assignPermissionsToRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignPermissionsDto: AssignPermissionsDto,
    @Req() request: Request,
  ) {
    return this.authService.assignPermissionsToRole(
      id,
      assignPermissionsDto,
      request.ip,
    );
  }

  @Delete(':roleId/permissions/:permissionId')
  @ApiBearerAuth('JWT-auth')
  @Permissions('role.update')
  @ApiOperation({ summary: 'Hapus permission dari role (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Permission berhasil dihapus dari role',
    content: {
      'application/json': {
        example: {
          message: 'Permission berhasil dihapus dari role',
        },
      },
    },
  })
  @ApiAuthErrors()
  @ApiNotFoundExample('Role atau permission tidak ditemukan')
  removePermissionFromRole(
    @Param('roleId', ParseIntPipe) roleId: number,
    @Param('permissionId', ParseIntPipe) permissionId: number,
    @Req() request: Request,
  ) {
    return this.authService.removePermissionFromRole(
      roleId,
      permissionId,
      request.ip,
    );
  }
}
