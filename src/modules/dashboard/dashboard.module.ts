import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardRepository } from './dashboard.repository';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, DashboardRepository, PrismaClient],
  exports: [DashboardService],
})
export class DashboardModule {}
