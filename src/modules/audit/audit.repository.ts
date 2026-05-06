import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma, PrismaClient } from '@prisma/client';

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private getClient(tx?: Prisma.TransactionClient): PrismaClientOrTx {
    return tx ?? this.prisma;
  }

  createAuditTrail(
    data: Prisma.AuditTrailCreateInput,
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.getClient(tx);
    return client.auditTrail.create({ data });
  }

  findAuditTrailById(id: string) {
    return this.prisma.auditTrail.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
  }

  findAuditTrails(params: {
    page: number;
    limit: number;
    action?: AuditAction;
    userId?: number;
    fromDate?: Date;
    toDate?: Date;
  }) {
    const { page, limit, action, userId, fromDate, toDate } = params;

    const where: Prisma.AuditTrailWhereInput = {
      ...(action ? { action } : {}),
      ...(typeof userId === 'number' ? { userId } : {}),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    };

    return this.prisma.auditTrail.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  countAuditTrails(params: {
    action?: AuditAction;
    userId?: number;
    fromDate?: Date;
    toDate?: Date;
  }) {
    const { action, userId, fromDate, toDate } = params;

    const where: Prisma.AuditTrailWhereInput = {
      ...(action ? { action } : {}),
      ...(typeof userId === 'number' ? { userId } : {}),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    };

    return this.prisma.auditTrail.count({ where });
  }
}
