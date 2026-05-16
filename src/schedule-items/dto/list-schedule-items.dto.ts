import { ScheduleItemStatus, ScheduleItemType } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';

export class ListScheduleItemsDto {
  @IsISO8601({ strict: true })
  @IsOptional()
  from?: string;

  @IsISO8601({ strict: true })
  @IsOptional()
  to?: string;

  @IsEnum(ScheduleItemType, { message: 'type must be EVENT or REMINDER' })
  @IsOptional()
  type?: ScheduleItemType;

  @IsEnum(ScheduleItemStatus)
  @IsOptional()
  status?: ScheduleItemStatus;

  @IsUUID()
  @IsOptional()
  calendarId?: string;
}
