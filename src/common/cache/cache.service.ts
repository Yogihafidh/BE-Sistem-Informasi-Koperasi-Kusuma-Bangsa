import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: any) {}

  async safeGet<T = unknown>(key: string): Promise<T | null> {
    try {
      const cached = await this.cacheManager.get(key);
      if (cached === null || cached === undefined) {
        return null;
      }

      return cached as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Cache get gagal untuk key ${key}: ${message}`);
      return null;
    }
  }

  async safeSet(key: string, value: unknown, ttlSeconds?: number) {
    try {
      const options = ttlSeconds ? { ttl: ttlSeconds } : undefined;
      await this.cacheManager.set(key, value, options as never);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Cache set gagal untuk key ${key}: ${message}`);
      return false;
    }
  }

  async safeDel(key: string) {
    try {
      await this.cacheManager.del(key);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Cache del gagal untuk key ${key}: ${message}`);
      return false;
    }
  }

  private async getKeyRegistry(registryKey: string): Promise<string[]> {
    const cached = await this.getJson<unknown>(registryKey);
    if (!Array.isArray(cached)) {
      return [];
    }

    return cached.filter((item): item is string => typeof item === 'string');
  }

  async getJson<T>(key: string): Promise<T | null> {
    const cached = await this.safeGet<unknown>(key);
    if (cached === null || cached === undefined) {
      return null;
    }

    if (typeof cached === 'string') {
      try {
        return JSON.parse(cached) as T;
      } catch {
        return null;
      }
    }

    return cached as T;
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number) {
    const payload = JSON.stringify(value);
    await this.safeSet(key, payload, ttlSeconds);
  }

  async getString(key: string): Promise<string | null> {
    const cached = await this.safeGet<unknown>(key);
    if (cached === null || cached === undefined) {
      return null;
    }
    return String(cached);
  }

  async setString(key: string, value: string, ttlSeconds?: number) {
    await this.safeSet(key, value, ttlSeconds);
  }

  async del(key: string) {
    await this.safeDel(key);
  }

  async registerKey(registryKey: string, key: string, ttlSeconds?: number) {
    const keys = await this.getKeyRegistry(registryKey);
    if (keys.includes(key)) {
      return;
    }

    keys.push(key);
    await this.setJson(registryKey, keys, ttlSeconds);
  }

  async getRegisteredKeys(registryKey: string) {
    return this.getKeyRegistry(registryKey);
  }

  async clearRegisteredKeys(registryKey: string, ttlSeconds?: number) {
    const keys = await this.getKeyRegistry(registryKey);
    const failedKeys: string[] = [];

    for (const key of keys) {
      try {
        const deleted = await this.safeDel(key);
        if (!deleted) {
          failedKeys.push(key);
        }
      } catch {
        failedKeys.push(key);
      }
    }

    await this.setJson<string[]>(registryKey, failedKeys, ttlSeconds);

    return {
      deletedCount: keys.length - failedKeys.length,
      failedKeys,
    };
  }
}
