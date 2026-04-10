import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { AuditRepository } from './audit.repository';
import { buildDiff, maskSensitiveFields } from './audit.utils';
import { DEFAULT_PAGE_SIZE } from '../../common/constants/pagination.constants';
import { getRequestContext } from '../../common/utils/request-context.util';

type LogPayload = {
  userId?: number | null;
  entityName?: string | null;
  entityId?: number | null;
  action: AuditAction;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

@Injectable()
export class AuditTrailService {
  constructor(private readonly auditRepository: AuditRepository) {}

  async getAuditTrailById(id: string) {
    const auditTrail = await this.auditRepository.findAuditTrailById(id);

    if (!auditTrail) {
      throw new NotFoundException('Audit trail tidak ditemukan');
    }

    return {
      message: 'Berhasil mengambil detail audit trail',
      data: auditTrail,
    };
  }

  async listAuditTrails(query: {
    page?: number;
    limit?: number;
    action?: AuditAction;
    userId?: number;
    fromDate?: string;
    toDate?: string;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limitRaw =
      query.limit && query.limit > 0 ? query.limit : DEFAULT_PAGE_SIZE;
    const limit = Math.min(limitRaw, 100);

    const fromDate = this.parseDate(query.fromDate, 'fromDate');
    const toDate = this.parseDate(query.toDate, 'toDate');

    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException(
        'fromDate tidak boleh lebih besar dari toDate',
      );
    }

    const filters = {
      action: query.action,
      userId: query.userId,
      fromDate,
      toDate,
    };

    const [data, total] = await Promise.all([
      this.auditRepository.findAuditTrails({ page, limit, ...filters }),
      this.auditRepository.countAuditTrails(filters),
    ]);

    const totalPages = total === 0 ? 1 : Math.ceil(total / limit);

    return {
      message: 'Berhasil mengambil data audit trail',
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  private parseDate(
    value: string | undefined,
    fieldName: string,
  ): Date | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(
        `${fieldName} harus berupa tanggal ISO yang valid`,
      );
    }

    return parsed;
  }

  async log(payload: LogPayload, tx?: Prisma.TransactionClient) {
    // ALUR AUDIT 1
    // Hitung perubahan data (before/after) yang benar-benar berubah.
    const { oldValue, newValue } = buildDiff(payload.before, payload.after);

    // ALUR AUDIT 2
    // Samarkan field sensitif sebelum disimpan ke audit trail.
    const maskedOldValue = maskSensitiveFields(oldValue);
    const maskedNewValue = maskSensitiveFields(newValue);

    const hasOldValue = payload.before && Object.keys(oldValue).length;
    const hasNewValue = payload.after && Object.keys(newValue).length;
    const contextualIp = getRequestContext()?.ipAddress;
    const effectiveIp = (payload.ipAddress ?? contextualIp ?? 'unknown').trim();

    // ALUR AUDIT 3
    // Susun payload insert audit trail dari data konteks aksi.
    const data: Prisma.AuditTrailCreateInput = {
      action: payload.action,
      ...(payload.userId ? { user: { connect: { id: payload.userId } } } : {}),
      ...(payload.entityName !== undefined && payload.entityName !== null
        ? { entityName: payload.entityName }
        : {}),
      ...(payload.entityId !== undefined && payload.entityId !== null
        ? { entityId: payload.entityId }
        : {}),
      // ALUR IP 1
      // Pakai ipAddress dari payload, fallback ke request context, lalu default "unknown".
      ipAddress: effectiveIp,
      ...(hasOldValue
        ? { oldValue: maskedOldValue as Prisma.InputJsonValue }
        : {}),
      ...(hasNewValue
        ? { newValue: maskedNewValue as Prisma.InputJsonValue }
        : {}),
    };

    // ALUR AUDIT 4
    // Insert data audit trail ke database melalui repository.
    return this.auditRepository.createAuditTrail(data, tx);
  }
}
