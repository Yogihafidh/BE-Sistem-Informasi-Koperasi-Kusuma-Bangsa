import { Global, Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AuditModule } from '../audit/audit.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { SettingsRepository } from './settings.repository';

@Global()
@Module({
  imports: [AuditModule],
  controllers: [SettingsController],
  providers: [SettingsService, SettingsRepository, PrismaClient],
  exports: [SettingsService],
})
export class SettingsModule {}
