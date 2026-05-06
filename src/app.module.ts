import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { PegawaiModule } from './modules/pegawai/pegawai.module';
import { NasabahModule } from './modules/nasabah/nasabah.module';
import { TransaksiModule } from './modules/transaksi/transaksi.module';
import { SimpananModule } from './modules/simpanan/simpanan.module';
import { PinjamanModule } from './modules/pinjaman/pinjaman.module';
import { AuditModule } from './modules/audit/audit.module';
import { LaporanModule } from './modules/laporan/laporan.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AppCacheModule } from './common/cache/cache.module';
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import databaseConfig from './config/database.config';

@Module({
  imports: [
    // Setup ConfigModule
    ConfigModule.forRoot({
      isGlobal: true, // Bisa dipakai di semua module tanpa import lagi
      envFilePath: '.env', // Lokasi file .env
      load: [appConfig, jwtConfig, databaseConfig], // Load semua config files
    }),
    ScheduleModule.forRoot(),
    AppCacheModule,
    AuthModule,
    PegawaiModule,
    NasabahModule,
    TransaksiModule,
    SimpananModule,
    PinjamanModule,
    AuditModule,
    LaporanModule,
    DashboardModule,
    SettingsModule,
  ],
})
export class AppModule {}
