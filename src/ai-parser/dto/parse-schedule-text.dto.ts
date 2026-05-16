import { IsLocale, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsTimeZone } from '../../common/validators/timezone.validator';

export class ParseScheduleTextDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text: string;

  @IsTimeZone()
  timezone: string;

  @IsLocale()
  @IsOptional()
  locale?: string;
}
