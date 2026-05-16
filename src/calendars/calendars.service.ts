import { Injectable, NotFoundException } from '@nestjs/common';
import { SyncOperation } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SYNC_ENTITY } from '../sync/sync.constants';
import { SyncService } from '../sync/sync.service';
import { CreateCalendarDto } from './dto/create-calendar.dto';
import { UpdateCalendarDto } from './dto/update-calendar.dto';

@Injectable()
export class CalendarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: SyncService,
  ) {}

  list(userId: string) {
    return this.prisma.calendar.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(userId: string, dto: CreateCalendarDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.calendar.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const calendar = await tx.calendar.create({
        data: {
          userId,
          name: dto.name,
          color: dto.color,
          isDefault: dto.isDefault ?? false,
        },
      });

      await this.syncService.recordChange(
        userId,
        SYNC_ENTITY.calendar,
        calendar.id,
        SyncOperation.CREATE,
        tx,
      );

      return calendar;
    });
  }

  async update(userId: string, id: string, dto: UpdateCalendarDto) {
    await this.ensureOwned(userId, id);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.calendar.updateMany({
          where: { userId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }

      const calendar = await tx.calendar.update({
        where: { id },
        data: dto,
      });

      await this.syncService.recordChange(
        userId,
        SYNC_ENTITY.calendar,
        calendar.id,
        SyncOperation.UPDATE,
        tx,
      );

      return calendar;
    });
  }

  async remove(userId: string, id: string) {
    await this.ensureOwned(userId, id);

    return this.prisma.$transaction(async (tx) => {
      await tx.calendar.delete({ where: { id } });
      await this.syncService.recordChange(
        userId,
        SYNC_ENTITY.calendar,
        id,
        SyncOperation.DELETE,
        tx,
      );

      return { success: true };
    });
  }

  private async ensureOwned(userId: string, id: string) {
    const calendar = await this.prisma.calendar.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!calendar) {
      throw new NotFoundException('Calendar not found');
    }
  }
}
