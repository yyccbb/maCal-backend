import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { TestNotificationDto } from './dto/test-notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notificationsService.list(user.id);
  }

  @Post('test')
  sendTest(@CurrentUser() user: AuthUser, @Body() dto: TestNotificationDto) {
    return this.notificationsService.sendTest(user.id, dto.title, dto.body);
  }

  @Post('reschedule/:scheduleItemId')
  reschedule(@CurrentUser() user: AuthUser, @Param('scheduleItemId') scheduleItemId: string) {
    return this.notificationsService.rescheduleForItem(user.id, scheduleItemId);
  }
}
