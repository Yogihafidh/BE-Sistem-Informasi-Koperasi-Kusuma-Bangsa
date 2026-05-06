import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RekapitulasiController } from './rekapitulasi.controller';
import { RekapitulasiService } from './rekapitulasi.service';
import { RekapitulasiRepository } from './rekapitulasi.repository';

@Module({
  controllers: [RekapitulasiController],
  providers: [RekapitulasiService, RekapitulasiRepository, PrismaClient],
  exports: [RekapitulasiService],
})
export class RekapitulasiModule {}
