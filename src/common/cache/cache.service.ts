import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  // INJECT CACHE MANAGER
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: any) {}

  // Ambil data dari cache
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

  // Simpan data ke cache dengan TTL opsional
  async safeSet(key: string, value: unknown, ttlSeconds?: number) {
    try {
      const ttlMs =
        typeof ttlSeconds === 'number'
          ? Math.max(1, Math.floor(ttlSeconds * 1000))
          : undefined;

      // Pada kombinasi cache-manager + Keyv, tulis langsung ke store agar TTL pasti diterapkan.
      const keyvStore = this.cacheManager?.stores?.[0];
      if (ttlMs !== undefined && typeof keyvStore?.set === 'function') {
        await keyvStore.set(key, value, ttlMs);
        return true;
      }

      await this.cacheManager.set(key, value, ttlMs);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Cache set gagal untuk key ${key}: ${message}`);
      return false;
    }
  }

  // Hapus data dari cache
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

  // Ambil daftar key terdaftar untuk invalidasi batch
  private async getKeyRegistry(registryKey: string): Promise<string[]> {
    const cached = await this.getJson<unknown>(registryKey);
    if (!Array.isArray(cached)) {
      return [];
    }

    return cached.filter((item): item is string => typeof item === 'string');
  }

  // Ambil data cache dan parse JSON bila payload berupa string
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

  // Serialize object ke JSON sebelum disimpan ke cache
  async setJson<T>(key: string, value: T, ttlSeconds?: number) {
    const payload = JSON.stringify(value);
    await this.safeSet(key, payload, ttlSeconds);
  }

  // Ambil nilai cache sebagai string untuk kasus flag sederhana
  async getString(key: string): Promise<string | null> {
    const cached = await this.safeGet<unknown>(key);
    if (cached === null || cached === undefined) {
      return null;
    }
    return String(cached);
  }

  // Simpan nilai string langsung ke cache.
  async setString(key: string, value: string, ttlSeconds?: number) {
    await this.safeSet(key, value, ttlSeconds);
  }

  // Alias hapus cache agar pemanggilan di service tetap ringkas
  async del(key: string) {
    await this.safeDel(key);
  }

  // Catat key cache ke registry agar mudah dihapus bersama
  async registerKey(registryKey: string, key: string, ttlSeconds?: number) {
    const keys = await this.getKeyRegistry(registryKey);
    if (keys.includes(key)) {
      return;
    }

    keys.push(key);
    await this.setJson(registryKey, keys, ttlSeconds);
  }

  // Ambil semua key cache yang terdaftar
  async getRegisteredKeys(registryKey: string) {
    return this.getKeyRegistry(registryKey);
  }

  // Hapus seluruh key pada registry dan simpan key yang gagal dihapus
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
