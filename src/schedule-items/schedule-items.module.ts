import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SyncModule } from '../sync/sync.module';
import { ScheduleItemsController } from './schedule-items.controller';
import { ScheduleItemsService } from './schedule-items.service';

@Module({
  imports: [NotificationsModule, SyncModule],
  controllers: [ScheduleItemsController],
  providers: [ScheduleItemsService],
  exports: [ScheduleItemsService],
})
export class ScheduleItemsModule {}
