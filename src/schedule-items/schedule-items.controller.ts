import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CreateScheduleItemDto } from './dto/create-schedule-item.dto';
import { ListScheduleItemsDto } from './dto/list-schedule-items.dto';
import { UpdateScheduleItemDto } from './dto/update-schedule-item.dto';
import { ScheduleItemsService } from './schedule-items.service';

@Controller('schedule-items')
@UseGuards(JwtAuthGuard)
export class ScheduleItemsController {
  constructor(private readonly scheduleItemsService: ScheduleItemsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListScheduleItemsDto) {
    return this.scheduleItemsService.list(user.id, query);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateScheduleItemDto) {
    return this.scheduleItemsService.create(user.id, dto);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.scheduleItemsService.getById(user.id, id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateScheduleItemDto) {
    return this.scheduleItemsService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.scheduleItemsService.remove(user.id, id);
  }

  @Post(':id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.scheduleItemsService.complete(user.id, id);
  }
}
