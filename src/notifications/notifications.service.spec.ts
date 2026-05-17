import { Logger } from '@nestjs/common';
import { NotificationChannel, NotificationStatus, ScheduleItemStatus } from '@prisma/client';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const prisma = {
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    scheduleItem: {
      findFirst: jest.fn(),
    },
    device: {
      findMany: jest.fn(),
    },
  };
  const queue = {
    add: jest.fn(),
    remove: jest.fn(),
  };
  const provider = {
    sendPush: jest.fn(),
  };

  let service: NotificationsService;
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    queue.add.mockResolvedValue(undefined);
    queue.remove.mockResolvedValue(1);
    service = new NotificationsService(
      prisma as any,
      queue as any,
      provider as any,
      provider as any,
      provider as any,
    );
  });

  afterEach(() => {
    loggerWarnSpy.mockRestore();
  });

  it('creates a notification and enqueues a reminder job', async () => {
    const triggerTime = new Date(Date.now() + 60_000);
    prisma.notification.create.mockResolvedValue({
      id: 'notification-id',
      userId: 'user-id',
      scheduleItemId: 'item-id',
      triggerTime,
      channel: NotificationChannel.PUSH,
      status: NotificationStatus.PENDING,
    });

    await service.scheduleForItem({
      id: 'item-id',
      userId: 'user-id',
      title: 'Call mom',
      reminderTime: triggerTime,
      status: ScheduleItemStatus.ACTIVE,
      deletedAt: null,
    });

    expect(prisma.notification.create).toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(
      'send-reminder',
      { notificationId: 'notification-id' },
      expect.objectContaining({ jobId: 'notification:notification-id' }),
    );
  });

  it('marks the notification failed when the reminder job cannot be enqueued', async () => {
    const triggerTime = new Date(Date.now() + 60_000);
    const notification = {
      id: 'notification-id',
      userId: 'user-id',
      scheduleItemId: 'item-id',
      triggerTime,
      channel: NotificationChannel.PUSH,
      status: NotificationStatus.PENDING,
    };
    const failedNotification = {
      ...notification,
      status: NotificationStatus.FAILED,
      errorMessage: 'Redis is down',
    };
    prisma.notification.create.mockResolvedValue(notification);
    prisma.notification.update.mockResolvedValue(failedNotification);
    queue.add.mockRejectedValueOnce(new Error('Redis is down'));

    const result = await service.scheduleForItem({
      id: 'item-id',
      userId: 'user-id',
      title: 'Call mom',
      reminderTime: triggerTime,
      status: ScheduleItemStatus.ACTIVE,
      deletedAt: null,
    });

    expect(result).toBe(failedNotification);
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notification-id' },
      data: {
        status: NotificationStatus.FAILED,
        errorMessage: 'Redis is down',
      },
    });
  });

  it('cancels pending jobs for an item', async () => {
    prisma.notification.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);

    const result = await service.cancelPendingForItem('user-id', 'item-id');

    expect(result.cancelled).toBe(2);
    expect(queue.remove).toHaveBeenCalledTimes(2);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] } },
      data: { status: NotificationStatus.CANCELLED },
    });
  });
});
