import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { REMINDERS_QUEUE } from './notifications.constants';
import { NotificationsController } from './notifications.controller';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';
import { ApnsPushProvider } from './providers/apns-push.provider';
import { ChinaPushProvider } from './providers/china-push.provider';
import { WebPushProvider } from './providers/web-push.provider';

@Module({
  imports: [
    BullModule.registerQueue({
      name: REMINDERS_QUEUE,
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsProcessor,
    ApnsPushProvider,
    WebPushProvider,
    ChinaPushProvider,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
