import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RekapitulasiModule } from './rekapitulasi/rekapitulasi.module';
import { LaporanController } from './laporan.controller';
import { LaporanService } from './laporan.service';
import { LaporanRepository } from './laporan.repository';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [RekapitulasiModule, AuditModule],
  controllers: [LaporanController],
  providers: [LaporanService, LaporanRepository, PrismaClient],
})
export class LaporanModule {}
