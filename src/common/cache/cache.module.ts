import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';
import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [
    // Register cache manager global
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        // Ambil URL Redis dari env
        const redisUrl =
          configService.get<string>('app.redisUrl') || 'redis://localhost:6379';
        return {
          // Hubungkan Keyv dengan Redis sebagai store
          stores: [new Keyv({ store: new KeyvRedis(redisUrl) })],
        } as never;
      },
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class AppCacheModule {}
