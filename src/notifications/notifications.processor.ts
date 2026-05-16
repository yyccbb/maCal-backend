import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { REMINDERS_QUEUE } from './notifications.constants';
import { NotificationsService } from './notifications.service';

@Processor(REMINDERS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<{ notificationId: string }>) {
    await this.notificationsService.deliverNotification(job.data.notificationId);
  }
}
