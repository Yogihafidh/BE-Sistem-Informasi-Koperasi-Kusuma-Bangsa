import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SimpananController } from './simpanan.controller';
import { SimpananService } from './simpanan.service';
import { SimpananRepository } from './simpanan.repository';
import { TransaksiRepository } from '../transaksi/transaksi.repository';
import { TransaksiModule } from '../transaksi/transaksi.module';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [TransaksiModule, DashboardModule],
  controllers: [SimpananController],
  providers: [
    SimpananService,
    SimpananRepository,
    TransaksiRepository,
    PrismaClient,
  ],
})
export class SimpananModule {}
