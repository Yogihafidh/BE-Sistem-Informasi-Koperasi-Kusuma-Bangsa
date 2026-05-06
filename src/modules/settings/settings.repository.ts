import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  listSettings() {
    return this.prisma.setting.findMany({
      orderBy: { key: 'asc' },
    });
  }

  findByKey(key: string) {
    return this.prisma.setting.findUnique({
      where: { key },
    });
  }

  updateSetting(args: { key: string; value: string; description?: string }) {
    const payload = {
      value: args.value,
      description: args.description,
    };

    return this.prisma.setting.update({
      where: { key: args.key },
      data: payload as never,
    });
  }
}
