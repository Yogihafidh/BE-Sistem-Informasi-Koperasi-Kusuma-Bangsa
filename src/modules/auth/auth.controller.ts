import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  RefreshTokenDto,
} from './dto';
import { Public, CurrentUser } from '../../common/decorators';
import {
  ApiAuthErrors,
  ApiBadRequestExample,
  ApiConflictExample,
  ApiForbiddenExample,
  ApiUnauthorizedExample,
} from '../../common/decorators/api-docs.decorator';
import { JwtAuthGuard, PermissionsGuard } from '../../common/guards';
import type { UserFromJwt } from './interfaces/jwt-payload.interface';

@ApiTags('auth')
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Registration User
  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register pengguna baru' })
  @ApiResponse({
    status: 201,
    description: 'Pengguna berhasil didaftarkan',
    content: {
      'application/json': {
        example: {
          message: 'Registrasi berhasil',
          user: {
            id: 1,
            username: 'johndoe',
            email: 'john.doe@example.com',
            isActive: true,
            createdAt: '2026-02-05T10:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiBadRequestExample('Data tidak valid')
  @ApiConflictExample('Username atau email sudah terdaftar')
  register(@Body() registerDto: RegisterDto, @Req() request: Request) {
    return this.authService.register(registerDto, request.ip);
  }

  // Login User
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login pengguna' })
  @ApiResponse({
    status: 200,
    description: 'Login berhasil, mengembalikan access token dan refresh token',
    content: {
      'application/json': {
        example: {
          message: 'Login berhasil',
          user: {
            id: 1,
            username: 'admin',
            email: 'admin@koperasi.com',
            roles: ['Admin'],
            permissions: ['user.read', 'role.read'],
          },
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  @ApiUnauthorizedExample('Username/email atau password salah')
  @ApiForbiddenExample('Akun tidak aktif')
  @HttpCode(200)
  login(@Body() loginDto: LoginDto, @Req() request: Request) {
    return this.authService.login(loginDto, request.ip);
  }

  // Get Profile of Logged-in User
  @Get('profile')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Mendapatkan profil pengguna yang sedang login' })
  @ApiResponse({
    status: 200,
    description: 'Profil pengguna berhasil diambil',
    content: {
      'application/json': {
        example: {
          id: 1,
          username: 'admin',
          email: 'admin@koperasi.com',
          isActive: true,
          lastLoginAt: '2026-02-05T09:50:00.000Z',
          createdAt: '2026-01-20T08:00:00.000Z',
          roles: ['Admin'],
          permissions: ['user.read', 'role.read'],
        },
      },
    },
  })
  @ApiAuthErrors()
  getProfile(@CurrentUser() user: UserFromJwt) {
    return this.authService.getProfile(user.userId);
  }

  // Change Password for Logged-in User
  @Post('change-password')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Ubah password pengguna yang sedang login' })
  @ApiResponse({
    status: 200,
    description: 'Password berhasil diubah',
    content: {
      'application/json': {
        example: {
          message: 'Password berhasil diubah',
        },
      },
    },
  })
  @ApiBadRequestExample(
    'Password lama salah atau konfirmasi password tidak cocok',
  )
  @ApiAuthErrors()
  @HttpCode(200)
  changePassword(
    @CurrentUser() user: UserFromJwt,
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() request: Request,
  ) {
    return this.authService.changePassword(
      user.userId,
      changePasswordDto,
      request.ip,
    );
  }

  // Refresh Token JWT
  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
      required: ['refreshToken'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Token berhasil di-refresh',
    content: {
      'application/json': {
        example: {
          message: 'Token berhasil diperbarui',
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  @ApiAuthErrors()
  @HttpCode(200)
  refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout pengguna' })
  @ApiResponse({
    status: 200,
    description: 'Logout berhasil',
    content: {
      'application/json': {
        example: {
          message: 'Logout berhasil',
        },
      },
    },
  })
  @ApiAuthErrors()
  @HttpCode(200)
  logout(@Req() request: Request) {
    const authHeader = request.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    return this.authService.logout(token, request.ip);
  }
}
