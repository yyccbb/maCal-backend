import { Injectable } from '@nestjs/common';
import { Prisma, SyncOperation } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SYNC_ENTITY } from './sync.constants';

type PrismaLike = Prisma.TransactionClient | PrismaService;

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async recordChange(
    userId: string,
    entityType: string,
    entityId: string,
    operation: SyncOperation,
    client: PrismaLike = this.prisma,
  ) {
    const latest = await client.syncChange.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    return client.syncChange.create({
      data: {
        userId,
        entityType,
        entityId,
        operation,
        version: (latest?.version ?? 0) + 1,
      },
    });
  }

  async getChanges(userId: string, sinceVersion: number) {
    const changes = await this.prisma.syncChange.findMany({
      where: {
        userId,
        version: { gt: sinceVersion },
        entityType: { in: [SYNC_ENTITY.calendar, SYNC_ENTITY.scheduleItem] },
      },
      orderBy: { version: 'asc' },
    });

    const enrichedChanges = await Promise.all(
      changes.map(async (change) => {
        if (change.entityType === SYNC_ENTITY.calendar && change.operation !== SyncOperation.DELETE) {
          const entity = await this.prisma.calendar.findFirst({
            where: { id: change.entityId, userId },
          });
          return { ...change, entity };
        }

        if (
          change.entityType === SYNC_ENTITY.scheduleItem &&
          change.operation !== SyncOperation.DELETE
        ) {
          const entity = await this.prisma.scheduleItem.findFirst({
            where: { id: change.entityId, userId },
          });
          return { ...change, entity };
        }

        return { ...change, entity: null };
      }),
    );

    return {
      sinceVersion,
      latestVersion: changes.at(-1)?.version ?? sinceVersion,
      changes: enrichedChanges,
    };
  }
}
