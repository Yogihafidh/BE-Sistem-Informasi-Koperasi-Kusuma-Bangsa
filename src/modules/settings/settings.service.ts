import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction } from '@prisma/client';
import { CacheService } from '../../common/cache/cache.service';
import { AuditTrailService } from '../audit/audit.service';
import { UpsertSettingDto } from './dto';
import { SettingsRepository } from './settings.repository';
import {
  SETTING_VALUE_TYPE,
  type SettingValueType,
} from './constants/settings.constants';

type SettingEntity = {
  id: number;
  key: string;
  value: string;
  valueType: SettingValueType;
  description: string | null;
  updatedAt: Date;
};

@Injectable()
export class SettingsService implements OnModuleInit {
  // Settup data settings cache dengan key
  private readonly cacheKeyAll = 'settings:all';
  private readonly cacheTtlSeconds: number;

  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    private readonly auditTrailService: AuditTrailService,
  ) {
    // Set cache hidup antara 5–10 menit
    const configured =
      this.configService.get<number>('app.cacheTtlSettingsSeconds') ?? 600;
    this.cacheTtlSeconds = Math.min(600, Math.max(300, Math.floor(configured)));
  }

  async onModuleInit() {
    // Saat aplikasi start langsung isi cache
    await this.warmCache();
  }

  private validateByType(value: string, valueType: SettingValueType) {
    if (valueType === SETTING_VALUE_TYPE.NUMBER) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        throw new BadRequestException('Value harus berupa angka valid');
      }
      return;
    }

    if (valueType === SETTING_VALUE_TYPE.BOOLEAN) {
      const normalized = value.toLowerCase();
      if (!['true', 'false', '1', '0'].includes(normalized)) {
        throw new BadRequestException(
          'Value boolean harus bernilai true/false/1/0',
        );
      }
      return;
    }

    if (valueType === SETTING_VALUE_TYPE.JSON) {
      try {
        JSON.parse(value);
      } catch {
        throw new BadRequestException('Value JSON tidak valid');
      }
    }
  }

  // Ambil data settings dari database
  private async loadSettingsFromDb(): Promise<SettingEntity[]> {
    const settings = (await this.settingsRepository.listSettings()) as Array<
      Record<string, unknown>
    >;
    return settings.map((item) => ({
      id: Number(item.id),
      key: String(item.key),
      value: String(item.value),
      valueType:
        (item.valueType as SettingValueType | undefined) ??
        SETTING_VALUE_TYPE.STRING,
      description:
        typeof item.description === 'string' ? item.description : null,
      updatedAt: new Date(item.updatedAt as Date | string),
    }));
  }

  // Simpan hasil query database ke cache saat startup.
  private async warmCache() {
    try {
      const settings = await this.loadSettingsFromDb();
      await this.cacheService.setJson(
        this.cacheKeyAll,
        settings,
        this.cacheTtlSeconds,
      );
    } catch {
      // Ignore cache warmup failures to avoid blocking app startup.
    }
  }

  // Get setting cache (Logic caching setting)
  private async getSettingsCached() {
    // Cek apakah data sudah ada di cache
    const cached = await this.cacheService.getJson<SettingEntity[]>(
      this.cacheKeyAll,
    );
    // Jika data ditemukan di cache, maka langsung digunakan tanpa query database
    if (cached !== null) {
      return cached;
    }

    // Jika tidak ditemukan, maka ambil dari database
    const settings = await this.loadSettingsFromDb();
    await this.cacheService.setJson(
      this.cacheKeyAll,
      settings,
      this.cacheTtlSeconds,
    );
    return settings;
  }

  // Get list settings (implementasi caching)
  async listSettings() {
    const data = (await this.getSettingsCached()).sort((a, b) =>
      a.key.localeCompare(b.key),
    );

    return {
      message: 'Berhasil mengambil daftar settings',
      data,
    };
  }

  // Get detail setting (implementasi caching)
  async getSetting(key: string) {
    const setting = (await this.getSettingsCached()).find(
      (item) => item.key === key,
    );
    if (!setting) {
      throw new NotFoundException(`Setting ${key} tidak ditemukan`);
    }

    return {
      message: 'Berhasil mengambil detail setting',
      data: setting,
    };
  }

  // Update setting logic (Invalidate caching)
  async updateSetting(
    key: string,
    dto: UpsertSettingDto,
    userId: number,
    ipAddress?: string,
  ) {
    const existing = await this.settingsRepository.findByKey(key);
    if (!existing) {
      throw new NotFoundException(`Setting ${key} tidak ditemukan`);
    }

    this.validateByType(dto.value, existing.valueType as SettingValueType);

    const updated = await this.settingsRepository.updateSetting({
      key,
      value: dto.value,
      description: dto.description,
    });

    // Implementasi insert audit trail saat setting diubah
    await this.auditTrailService.log({
      action: AuditAction.UPDATE,
      userId,
      entityName: 'Setting',
      entityId: existing.id,
      ipAddress,
      before: {
        key: existing.key,
        value: existing.value,
        valueType: existing.valueType,
        description: existing.description,
        updatedAt: existing.updatedAt.toISOString(),
      },
      after: {
        key: updated.key,
        value: updated.value,
        valueType: updated.valueType,
        description: updated.description,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });

    // Hapus cache saat update agar data tetap konsisten
    await this.cacheService.del(this.cacheKeyAll);
    return {
      message: 'Setting berhasil diperbarui',
      data: updated,
    };
  }

  // Ekstra helper untuk setting number agar lebih mudah digunakan di service lain
  async getNumber(key: string) {
    const setting = await this.getSettingEntity(key);
    if (setting.valueType !== SETTING_VALUE_TYPE.NUMBER) {
      throw new BadRequestException(`Setting ${key} bukan bertipe NUMBER`);
    }

    const parsed = Number(setting.value);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(`Value setting ${key} bukan angka valid`);
    }

    return parsed;
  }

  // Ekstra helper untuk setting boolean agar lebih mudah digunakan di service lain
  async getBoolean(key: string) {
    const setting = await this.getSettingEntity(key);
    if (setting.valueType !== SETTING_VALUE_TYPE.BOOLEAN) {
      throw new BadRequestException(`Setting ${key} bukan bertipe BOOLEAN`);
    }

    const normalized = setting.value.toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }

    throw new BadRequestException(`Value setting ${key} bukan boolean valid`);
  }

  // Ekstra helper untuk setting JSON agar lebih mudah digunakan di service lain
  private async getSettingEntity(key: string) {
    // Lookup setting selalu lewat cache layer agar konsisten.
    const setting = (await this.getSettingsCached()).find(
      (item) => item.key === key,
    );
    if (!setting) {
      throw new NotFoundException(`Setting ${key} tidak ditemukan`);
    }

    return setting;
  }
}
