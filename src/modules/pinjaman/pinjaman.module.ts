import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PinjamanController } from './pinjaman.controller';
import { PinjamanService } from './pinjaman.service';
import { PinjamanRepository } from './pinjaman.repository';
import { TransaksiRepository } from '../transaksi/transaksi.repository';
import { TransaksiModule } from '../transaksi/transaksi.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule, TransaksiModule],
  controllers: [PinjamanController],
  providers: [
    PinjamanService,
    PinjamanRepository,
    TransaksiRepository,
    PrismaClient,
  ],
})
export class PinjamanModule {}
