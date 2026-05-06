import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AuditRepository } from './audit.repository';
import { AuditTrailService } from './audit.service';
import { AuditController } from './audit.controller';

@Module({
  controllers: [AuditController],
  providers: [AuditTrailService, AuditRepository, PrismaClient],
  exports: [AuditTrailService],
})
export class AuditModule {}
