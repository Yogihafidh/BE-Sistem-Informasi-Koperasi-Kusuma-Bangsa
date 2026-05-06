import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PegawaiController } from './pegawai.controller';
import { PegawaiService } from './pegawai.service';
import { PegawaiRepository } from './pegawai.repository';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PegawaiController],
  providers: [PegawaiService, PegawaiRepository, PrismaClient],
})
export class PegawaiModule {}
