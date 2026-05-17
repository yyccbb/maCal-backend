import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, ScheduleItem, ScheduleItemStatus, ScheduleItemType, SyncOperation } from '@prisma/client';
import { parseIsoDate, requireDate } from '../common/utils/date.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SYNC_ENTITY } from '../sync/sync.constants';
import { SyncService } from '../sync/sync.service';
import { CreateScheduleItemDto } from './dto/create-schedule-item.dto';
import { ListScheduleItemsDto } from './dto/list-schedule-items.dto';
import { UpdateScheduleItemDto } from './dto/update-schedule-item.dto';

type NormalizedScheduleItem = {
  type: ScheduleItemType;
  title: string;
  description?: string | null;
  calendarId?: string | null;
  startTime?: Date | null;
  endTime?: Date | null;
  reminderTime?: Date | null;
  timezone: string;
  recurrenceRule?: string | null;
  status?: ScheduleItemStatus;
  sourceText?: string | null;
  aiConfidence?: number | null;
};

@Injectable()
export class ScheduleItemsService {
  private readonly logger = new Logger(ScheduleItemsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly syncService: SyncService,
  ) {}

  async list(userId: string, query: ListScheduleItemsDto) {
    const from = parseIsoDate(query.from, 'from');
    const to = parseIsoDate(query.to, 'to');
    if (from && to && to <= from) {
      throw new BadRequestException('to must be after from');
    }

    const where: Prisma.ScheduleItemWhereInput = {
      userId,
      deletedAt: null,
      type: query.type,
      status: query.status,
      calendarId: query.calendarId,
    };

    if (from || to) {
      const range: Prisma.DateTimeNullableFilter = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      };

      where.OR = [{ startTime: range }, { endTime: range }, { reminderTime: range }];
    }

    return this.prisma.scheduleItem.findMany({
      where,
      orderBy: [{ startTime: 'asc' }, { reminderTime: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, dto: CreateScheduleItemDto) {
    const data = this.normalizeCreate(dto);
    await this.validateCalendar(userId, data.calendarId);
    this.validateScheduleShape(data);

    const item = await this.prisma.$transaction(async (tx) => {
      const created = await tx.scheduleItem.create({
        data: {
          userId,
          calendarId: data.calendarId,
          type: data.type,
          title: data.title,
          description: data.description,
          startTime: data.startTime,
          endTime: data.endTime,
          reminderTime: data.reminderTime,
          timezone: data.timezone,
          recurrenceRule: data.recurrenceRule,
          sourceText: data.sourceText,
          aiConfidence: data.aiConfidence,
        },
      });

      await this.syncService.recordChange(
        userId,
        SYNC_ENTITY.scheduleItem,
        created.id,
        SyncOperation.CREATE,
        tx,
      );

      return created;
    });

    await this.runNotificationMaintenance(
      () => this.notificationsService.scheduleForItem(item),
      `schedule notification for schedule item ${item.id}`,
    );
    return item;
  }

  async getById(userId: string, id: string) {
    const item = await this.prisma.scheduleItem.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!item) {
      throw new NotFoundException('Schedule item not found');
    }

    return item;
  }

  async update(userId: string, id: string, dto: UpdateScheduleItemDto) {
    const existing = await this.getById(userId, id);
    const merged = this.normalizeUpdate(existing, dto);
    await this.validateCalendar(userId, merged.calendarId);
    this.validateScheduleShape(merged);

    const item = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.scheduleItem.update({
        where: { id },
        data: {
          type: merged.type,
          title: merged.title,
          description: merged.description,
          calendarId: merged.calendarId,
          startTime: merged.startTime,
          endTime: merged.endTime,
          reminderTime: merged.reminderTime,
          timezone: merged.timezone,
          recurrenceRule: merged.recurrenceRule,
          status: merged.status,
          sourceText: merged.sourceText,
          aiConfidence: merged.aiConfidence,
        },
      });

      await this.syncService.recordChange(
        userId,
        SYNC_ENTITY.scheduleItem,
        updated.id,
        SyncOperation.UPDATE,
        tx,
      );

      return updated;
    });

    await this.runNotificationMaintenance(
      () => this.notificationsService.cancelPendingForItem(userId, item.id),
      `cancel pending notifications for schedule item ${item.id}`,
    );
    await this.runNotificationMaintenance(
      () => this.notificationsService.scheduleForItem(item),
      `schedule notification for schedule item ${item.id}`,
    );
    return item;
  }

  async remove(userId: string, id: string) {
    await this.getById(userId, id);

    await this.prisma.$transaction(async (tx) => {
      await tx.scheduleItem.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: ScheduleItemStatus.CANCELLED,
        },
      });

      await this.syncService.recordChange(
        userId,
        SYNC_ENTITY.scheduleItem,
        id,
        SyncOperation.DELETE,
        tx,
      );
    });

    await this.runNotificationMaintenance(
      () => this.notificationsService.cancelPendingForItem(userId, id),
      `cancel pending notifications for schedule item ${id}`,
    );
    return { success: true };
  }

  async complete(userId: string, id: string) {
    const existing = await this.getById(userId, id);
    const item = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.scheduleItem.update({
        where: { id },
        data: { status: ScheduleItemStatus.COMPLETED },
      });

      await this.syncService.recordChange(
        userId,
        SYNC_ENTITY.scheduleItem,
        id,
        SyncOperation.UPDATE,
        tx,
      );

      return updated;
    });

    if (existing.status !== ScheduleItemStatus.COMPLETED) {
      await this.runNotificationMaintenance(
        () => this.notificationsService.cancelPendingForItem(userId, id),
        `cancel pending notifications for schedule item ${id}`,
      );
    }

    return item;
  }

  private normalizeCreate(dto: CreateScheduleItemDto): NormalizedScheduleItem {
    const startTime = parseIsoDate(dto.startTime, 'startTime');
    const endTime = parseIsoDate(dto.endTime, 'endTime');
    const reminderTime = parseIsoDate(dto.reminderTime, 'reminderTime');

    return {
      ...dto,
      startTime: dto.type === ScheduleItemType.REMINDER ? null : startTime,
      endTime: dto.type === ScheduleItemType.REMINDER ? null : endTime,
      reminderTime,
    };
  }

  private normalizeUpdate(
    existing: ScheduleItem,
    dto: UpdateScheduleItemDto,
  ): NormalizedScheduleItem {
    const nextType = dto.type ?? existing.type;
    const startTime =
      dto.startTime === undefined ? existing.startTime : parseIsoDate(dto.startTime, 'startTime');
    const endTime = dto.endTime === undefined ? existing.endTime : parseIsoDate(dto.endTime, 'endTime');
    const reminderTime =
      dto.reminderTime === undefined
        ? existing.type === ScheduleItemType.REMINDER && nextType === ScheduleItemType.EVENT
          ? null
          : existing.reminderTime
        : parseIsoDate(dto.reminderTime, 'reminderTime');

    return {
      type: nextType,
      title: dto.title ?? existing.title,
      description: dto.description === undefined ? existing.description : dto.description,
      calendarId: dto.calendarId === undefined ? existing.calendarId : dto.calendarId,
      startTime: nextType === ScheduleItemType.REMINDER ? null : startTime,
      endTime: nextType === ScheduleItemType.REMINDER ? null : endTime,
      reminderTime,
      timezone: dto.timezone ?? existing.timezone,
      recurrenceRule:
        dto.recurrenceRule === undefined ? existing.recurrenceRule : dto.recurrenceRule,
      status: dto.status ?? existing.status,
      sourceText: dto.sourceText === undefined ? existing.sourceText : dto.sourceText,
      aiConfidence: dto.aiConfidence === undefined ? existing.aiConfidence : dto.aiConfidence,
    };
  }

  private validateScheduleShape(item: NormalizedScheduleItem) {
    if (item.type === ScheduleItemType.REMINDER) {
      requireDate(item.reminderTime ?? null, 'reminderTime');
    }

    if (item.type === ScheduleItemType.EVENT) {
      const startTime = requireDate(item.startTime ?? null, 'startTime');
      const endTime = requireDate(item.endTime ?? null, 'endTime');

      if (endTime <= startTime) {
        throw new BadRequestException('endTime must be after startTime');
      }
    }
  }

  private async validateCalendar(userId: string, calendarId?: string | null) {
    if (!calendarId) {
      return;
    }

    const calendar = await this.prisma.calendar.findFirst({
      where: { id: calendarId, userId },
      select: { id: true },
    });

    if (!calendar) {
      throw new BadRequestException('calendarId does not belong to the current user');
    }
  }

  private async runNotificationMaintenance(action: () => Promise<unknown>, label: string) {
    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.warn(`Failed to ${label}: ${message}`, stack);
    }
  }
}
