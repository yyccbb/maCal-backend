import { ScheduleItemStatus, ScheduleItemType } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsTimeZone } from '../../common/validators/timezone.validator';

export class UpdateScheduleItemDto {
  @IsEnum(ScheduleItemType, { message: 'type must be EVENT or REMINDER' })
  @IsOptional()
  type?: ScheduleItemType;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  @IsOptional()
  title?: string;

  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID()
  @IsOptional()
  calendarId?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsISO8601({ strict: true })
  @IsOptional()
  startTime?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsISO8601({ strict: true })
  @IsOptional()
  endTime?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsISO8601({ strict: true })
  @IsOptional()
  reminderTime?: string | null;

  @IsTimeZone()
  @IsOptional()
  timezone?: string;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  recurrenceRule?: string | null;

  @IsEnum(ScheduleItemStatus)
  @IsOptional()
  status?: ScheduleItemStatus;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  sourceText?: string | null;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  aiConfidence?: number | null;
}
