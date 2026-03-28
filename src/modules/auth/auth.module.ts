import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { PrismaClient } from '@prisma/client';
import { AuthController } from './auth.controller';
import { UsersController } from './users.controller';
import { RolesController } from './roles.controller';
import { PermissionsController } from './permissions.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { JwtStrategy, LocalStrategy } from './strategies';
import { AuditModule } from '../audit/audit.module';
import { SecurityLogService } from './security-log.service';

@Module({
  imports: [
    PassportModule,
    AuditModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret =
          configService.get<string>('jwt.secret') ||
          'your-secret-key-change-in-production';
        const expiresIn =
          configService.get<string>('jwt.accessTokenExpiresIn') || '15m';

        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as StringValue,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [
    AuthController,
    UsersController,
    RolesController,
    PermissionsController,
  ],
  providers: [
    AuthService,
    AuthRepository,
    SecurityLogService,
    PrismaClient,
    JwtStrategy,
    LocalStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
