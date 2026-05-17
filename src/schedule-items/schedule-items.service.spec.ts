import { BadRequestException, Logger } from '@nestjs/common';
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
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    prisma.calendar.findFirst.mockResolvedValue({ id: 'calendar-id' });
    prisma.scheduleItem.findFirst.mockResolvedValue(null);
    notifications.scheduleForItem.mockResolvedValue(null);
    notifications.cancelPendingForItem.mockResolvedValue({ cancelled: 0 });
    sync.recordChange.mockResolvedValue({ operation: SyncOperation.CREATE });
    service = new ScheduleItemsService(prisma as any, notifications as any, sync as any);
  });

  afterEach(() => {
    loggerWarnSpy.mockRestore();
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

  it('returns the created item when notification scheduling fails', async () => {
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
    notifications.scheduleForItem.mockRejectedValueOnce(new Error('Redis is down'));

    const result = await service.create('user-id', {
      type: ScheduleItemType.REMINDER,
      title: 'Call mom',
      reminderTime: '2026-05-14T19:00:00+08:00',
      timezone: 'Asia/Shanghai',
    });

    expect(result).toBe(created);
  });

  it('returns the updated item when notification maintenance fails', async () => {
    const existing = {
      id: 'item-id',
      userId: 'user-id',
      type: ScheduleItemType.EVENT,
      title: 'Dinner',
      startTime: new Date('2026-05-14T11:00:00.000Z'),
      endTime: new Date('2026-05-14T12:00:00.000Z'),
      reminderTime: null,
      timezone: 'Asia/Shanghai',
      status: ScheduleItemStatus.ACTIVE,
      deletedAt: null,
    };
    const updated = { ...existing, title: 'Dinner with Alex' };
    prisma.scheduleItem.findFirst.mockResolvedValue(existing);
    tx.scheduleItem.update.mockResolvedValue(updated);
    notifications.cancelPendingForItem.mockRejectedValueOnce(new Error('cancel failed'));
    notifications.scheduleForItem.mockRejectedValueOnce(new Error('schedule failed'));

    const result = await service.update('user-id', 'item-id', {
      title: 'Dinner with Alex',
    });

    expect(result).toBe(updated);
    expect(notifications.cancelPendingForItem).toHaveBeenCalledWith('user-id', 'item-id');
    expect(notifications.scheduleForItem).toHaveBeenCalledWith(updated);
  });

  it('clears reminder start and end times before saving', async () => {
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

    await service.create('user-id', {
      type: ScheduleItemType.REMINDER,
      title: 'Call mom',
      startTime: '2026-05-14T10:00:00+08:00',
      endTime: '2026-05-14T11:00:00+08:00',
      reminderTime: '2026-05-14T19:00:00+08:00',
      timezone: 'Asia/Shanghai',
    });

    expect(tx.scheduleItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startTime: null,
          endTime: null,
        }),
      }),
    );
  });

  it('does not preserve reminder due time when converting a reminder to an event', async () => {
    const existing = {
      id: 'item-id',
      userId: 'user-id',
      type: ScheduleItemType.REMINDER,
      title: 'Call mom',
      startTime: null,
      endTime: null,
      reminderTime: new Date('2026-05-14T11:00:00.000Z'),
      timezone: 'Asia/Shanghai',
      status: ScheduleItemStatus.ACTIVE,
      deletedAt: null,
    };
    const updated = { ...existing, type: ScheduleItemType.EVENT };
    prisma.scheduleItem.findFirst.mockResolvedValue(existing);
    tx.scheduleItem.update.mockResolvedValue(updated);

    await service.update('user-id', 'item-id', {
      type: ScheduleItemType.EVENT,
      startTime: '2026-05-15T19:00:00+08:00',
      endTime: '2026-05-15T21:00:00+08:00',
    });

    expect(tx.scheduleItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reminderTime: null,
        }),
      }),
    );
  });

  it('clears event start and end times when converting an event to a reminder', async () => {
    const existing = {
      id: 'item-id',
      userId: 'user-id',
      type: ScheduleItemType.EVENT,
      title: 'Dinner',
      startTime: new Date('2026-05-14T11:00:00.000Z'),
      endTime: new Date('2026-05-14T12:00:00.000Z'),
      reminderTime: null,
      timezone: 'Asia/Shanghai',
      status: ScheduleItemStatus.ACTIVE,
      deletedAt: null,
    };
    const updated = { ...existing, type: ScheduleItemType.REMINDER };
    prisma.scheduleItem.findFirst.mockResolvedValue(existing);
    tx.scheduleItem.update.mockResolvedValue(updated);

    await service.update('user-id', 'item-id', {
      type: ScheduleItemType.REMINDER,
      reminderTime: '2026-05-15T19:00:00+08:00',
    });

    expect(tx.scheduleItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          startTime: null,
          endTime: null,
        }),
      }),
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
