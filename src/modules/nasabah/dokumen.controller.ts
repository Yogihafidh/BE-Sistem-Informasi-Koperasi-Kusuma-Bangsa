import {
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, Permissions } from '../../common/decorators';
import { JwtAuthGuard, PermissionsGuard } from '../../common/guards';
import {
  ApiAuthErrors,
  ApiBadRequestExample,
  ApiNotFoundExample,
} from '../../common/decorators/api-docs.decorator';
import { getClientIp } from '../../common/utils/request-ip.util';
import type { Request } from 'express';
import type { UserFromJwt } from '../auth/interfaces/jwt-payload.interface';
import { NasabahService } from './nasabah.service';

@ApiTags('nasabah')
@Controller('dokumen')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DokumenController {
  constructor(private readonly nasabahService: NasabahService) {}

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @Permissions('nasabah.update')
  @ApiOperation({ summary: 'Soft delete dokumen nasabah' })
  @ApiResponse({
    status: 200,
    description: 'Dokumen nasabah berhasil dihapus',
    content: {
      'application/json': {
        example: {
          message: 'Dokumen nasabah berhasil dihapus',
        },
      },
    },
  })
  @ApiNotFoundExample('Dokumen nasabah tidak ditemukan')
  @ApiBadRequestExample('Dokumen nasabah sudah dihapus')
  @ApiAuthErrors()
  deleteDokumenNasabah(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UserFromJwt,
    @Req() request: Request,
  ) {
    return this.nasabahService.deleteDokumenNasabah(
      id,
      user,
      getClientIp(request),
    );
  }
}
