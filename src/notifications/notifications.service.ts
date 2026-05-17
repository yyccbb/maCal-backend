import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  Device,
  DevicePlatform,
  NotificationChannel,
  NotificationStatus,
  ScheduleItem,
  ScheduleItemStatus,
} from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { REMINDERS_QUEUE } from './notifications.constants';
import { ApnsPushProvider } from './providers/apns-push.provider';
import { ChinaPushProvider } from './providers/china-push.provider';
import { PushProvider } from './providers/push-provider.interface';
import { WebPushProvider } from './providers/web-push.provider';

type SchedulableItem = Pick<
  ScheduleItem,
  'id' | 'userId' | 'title' | 'reminderTime' | 'status' | 'deletedAt'
>;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(REMINDERS_QUEUE) private readonly remindersQueue: Queue,
    private readonly apnsPushProvider: ApnsPushProvider,
    private readonly webPushProvider: WebPushProvider,
    private readonly chinaPushProvider: ChinaPushProvider,
  ) {}

  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { triggerTime: 'desc' },
      take: 100,
    });
  }

  async scheduleForItem(item: SchedulableItem) {
    if (!item.reminderTime || item.deletedAt || item.status !== ScheduleItemStatus.ACTIVE) {
      return null;
    }

    const notification = await this.prisma.notification.create({
      data: {
        userId: item.userId,
        scheduleItemId: item.id,
        triggerTime: item.reminderTime,
        channel: NotificationChannel.PUSH,
        status: NotificationStatus.PENDING,
      },
    });

    try {
      await this.enqueueNotification(notification.id, notification.triggerTime);
      return notification;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown queue error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.warn(
        `Failed to enqueue notification ${notification.id}: ${errorMessage}`,
        stack,
      );

      return this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.FAILED,
          errorMessage,
        },
      });
    }
  }

  async rescheduleForItem(userId: string, scheduleItemId: string) {
    const item = await this.prisma.scheduleItem.findFirst({
      where: { id: scheduleItemId, userId, deletedAt: null },
    });

    if (!item) {
      throw new NotFoundException('Schedule item not found');
    }

    await this.cancelPendingForItem(userId, scheduleItemId);
    return this.scheduleForItem(item);
  }

  async cancelPendingForItem(userId: string, scheduleItemId: string) {
    const pending = await this.prisma.notification.findMany({
      where: {
        userId,
        scheduleItemId,
        status: NotificationStatus.PENDING,
      },
      select: { id: true },
    });

    await Promise.all(
      pending.map((notification) =>
        this.remindersQueue.remove(this.jobId(notification.id)).catch(() => undefined),
      ),
    );

    if (pending.length > 0) {
      await this.prisma.notification.updateMany({
        where: { id: { in: pending.map((notification) => notification.id) } },
        data: { status: NotificationStatus.CANCELLED },
      });
    }

    return { cancelled: pending.length };
  }

  async sendTest(userId: string, title = 'Test notification', body = 'This is a test notification.') {
    const devices = await this.prisma.device.findMany({ where: { userId } });
    await Promise.all(
      devices.map((device) =>
        this.providerForDevice(device).sendPush({
          userId,
          deviceId: device.id,
          pushToken: device.pushToken,
          title,
          body,
          data: { kind: 'test' },
        }),
      ),
    );

    return { sentToDevices: devices.length };
  }

  async deliverNotification(notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: { scheduleItem: true },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const item = notification.scheduleItem;
    if (
      notification.status !== NotificationStatus.PENDING ||
      item.deletedAt ||
      item.status !== ScheduleItemStatus.ACTIVE
    ) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.CANCELLED },
      });
      return;
    }

    const devices = await this.prisma.device.findMany({
      where: { userId: notification.userId },
    });

    try {
      if (devices.length === 0) {
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { status: NotificationStatus.SENT, provider: 'console-placeholder' },
        });
        return;
      }

      await Promise.all(
        devices.map((device) =>
          this.providerForDevice(device).sendPush({
            userId: notification.userId,
            deviceId: device.id,
            pushToken: device.pushToken,
            title: 'Reminder',
            body: process.env.NODE_ENV === 'production' ? undefined : item.title,
            data: {
              scheduleItemId: item.id,
              notificationId: notification.id,
            },
          }),
        ),
      );

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.SENT, provider: 'placeholder' },
      });
    } catch (error) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'Unknown push error',
        },
      });
      throw error;
    }
  }

  private async enqueueNotification(notificationId: string, triggerTime: Date) {
    const delay = Math.max(0, triggerTime.getTime() - Date.now());
    if (!Number.isFinite(delay)) {
      throw new BadRequestException('Notification triggerTime is invalid');
    }

    await this.remindersQueue.add(
      'send-reminder',
      { notificationId },
      {
        jobId: this.jobId(notificationId),
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }

  private jobId(notificationId: string) {
    return `notification:${notificationId}`;
  }

  private providerForDevice(device: Device): PushProvider {
    if (device.platform === DevicePlatform.IOS) {
      return this.apnsPushProvider;
    }

    if (device.platform === DevicePlatform.WEB) {
      return this.webPushProvider;
    }

    return this.chinaPushProvider;
  }
}
