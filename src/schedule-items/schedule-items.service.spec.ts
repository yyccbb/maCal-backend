import { BadRequestException } from '@nestjs/common';
import { ScheduleItemStatus, ScheduleItemType, SyncOperation } from '@prisma/client';
import { ScheduleItemsService } from './schedule-items.service';

describe('ScheduleItemsService', () => {
  const tx = {
    scheduleItem: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    calendar: {
      findFirst: jest.fn(),
    },
    scheduleItem: {
      findFirst: jest.fn(),
    },
  };
  const notifications = {
    scheduleForItem: jest.fn(),
    cancelPendingForItem: jest.fn(),
  };
  const sync = {
    recordChange: jest.fn(),
  };

  let service: ScheduleItemsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.calendar.findFirst.mockResolvedValue({ id: 'calendar-id' });
    sync.recordChange.mockResolvedValue({ operation: SyncOperation.CREATE });
    service = new ScheduleItemsService(prisma as any, notifications as any, sync as any);
  });

  it('creates a reminder and schedules a notification', async () => {
    const created = {
      id: 'item-id',
      userId: 'user-id',
      type: ScheduleItemType.REMINDER,
      title: 'Call mom',
      reminderTime: new Date('2026-05-14T11:00:00.000Z'),
      status: ScheduleItemStatus.ACTIVE,
      deletedAt: null,
    };
    tx.scheduleItem.create.mockResolvedValue(created);

    const result = await service.create('user-id', {
      type: ScheduleItemType.REMINDER,
      title: 'Call mom',
      reminderTime: '2026-05-14T19:00:00+08:00',
      timezone: 'Asia/Shanghai',
    });

    expect(result).toBe(created);
    expect(notifications.scheduleForItem).toHaveBeenCalledWith(created);
    expect(sync.recordChange).toHaveBeenCalledWith(
      'user-id',
      'ScheduleItem',
      'item-id',
      SyncOperation.CREATE,
      tx,
    );
  });

  it('rejects an event whose end time is not after start time', async () => {
    await expect(
      service.create('user-id', {
        type: ScheduleItemType.EVENT,
        title: 'Meeting',
        startTime: '2026-05-14T10:00:00+08:00',
        endTime: '2026-05-14T09:00:00+08:00',
        timezone: 'Asia/Shanghai',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
