import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../common/decorators';
import { JwtAuthGuard, PermissionsGuard } from '../../common/guards';
import { ApiAuthErrors } from '../../common/decorators/api-docs.decorator';
import { UpsertSettingDto } from './dto';
import { SettingsService } from './settings.service';
import type { UserFromJwt } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiBearerAuth('JWT-auth')
  @Permissions('settings.read')
  @ApiOperation({ summary: 'Daftar seluruh settings sistem' })
  @ApiResponse({
    status: 200,
    description: 'Daftar settings berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil daftar settings',
          data: [
            {
              id: 1,
              key: 'loan.maxTenorMonths',
              value: '24',
              valueType: 'NUMBER',
              description: 'Batas maksimum tenor pinjaman (bulan)',
              updatedAt: '2026-02-19T10:00:00.000Z',
            },
            {
              id: 2,
              key: 'savings.allowWithdrawalIfLoanActive',
              value: 'false',
              valueType: 'BOOLEAN',
              description: 'Izin tarik simpanan saat pinjaman masih aktif',
              updatedAt: '2026-02-19T10:00:00.000Z',
            },
          ],
        },
      },
    },
  })
  @ApiAuthErrors()
  listSettings() {
    return this.settingsService.listSettings();
  }

  @Get(':key')
  @ApiBearerAuth('JWT-auth')
  @Permissions('settings.read')
  @ApiOperation({ summary: 'Detail setting berdasarkan key' })
  @ApiResponse({
    status: 200,
    description: 'Detail setting berhasil diambil',
    content: {
      'application/json': {
        example: {
          message: 'Berhasil mengambil detail setting',
          data: {
            id: 1,
            key: 'loan.maxTenorMonths',
            value: '24',
            valueType: 'NUMBER',
            description: 'Batas maksimum tenor pinjaman (bulan)',
            updatedAt: '2026-02-19T10:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiAuthErrors()
  getSetting(@Param('key') key: string) {
    return this.settingsService.getSetting(key);
  }

  @Put(':key')
  @ApiBearerAuth('JWT-auth')
  @Permissions('settings.update')
  @ApiOperation({ summary: 'Update setting sistem' })
  @ApiResponse({
    status: 200,
    description: 'Setting berhasil diperbarui',
    content: {
      'application/json': {
        example: {
          message: 'Setting berhasil diperbarui',
          data: {
            id: 1,
            key: 'loan.maxTenorMonths',
            value: '36',
            valueType: 'NUMBER',
            description: 'Batas maksimum tenor pinjaman (bulan)',
            updatedAt: '2026-03-10T11:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiAuthErrors()
  updateSetting(
    @Param('key') key: string,
    @Body() dto: UpsertSettingDto,
    @CurrentUser() user: UserFromJwt,
    @Req() request: Request,
  ) {
    return this.settingsService.updateSetting(
      key,
      dto,
      user.userId,
      request.ip,
    );
  }
}
