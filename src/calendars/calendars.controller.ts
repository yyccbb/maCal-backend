import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CalendarsService } from './calendars.service';
import { CreateCalendarDto } from './dto/create-calendar.dto';
import { UpdateCalendarDto } from './dto/update-calendar.dto';

@Controller('calendars')
@UseGuards(JwtAuthGuard)
export class CalendarsController {
  constructor(private readonly calendarsService: CalendarsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.calendarsService.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCalendarDto) {
    return this.calendarsService.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCalendarDto) {
    return this.calendarsService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.calendarsService.remove(user.id, id);
  }
}
