import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TransaksiController } from './transaksi.controller';
import { TransaksiRelationsController } from './transaksi.relations.controller';
import { TransaksiService } from './transaksi.service';
import { TransaksiRepository } from './transaksi.repository';
import { DashboardModule } from '../dashboard/dashboard.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [DashboardModule, AuditModule],
  controllers: [TransaksiController, TransaksiRelationsController],
  providers: [TransaksiService, TransaksiRepository, PrismaClient],
  exports: [TransaksiService],
})
export class TransaksiModule {}
