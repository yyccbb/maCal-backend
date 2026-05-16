import { IsLocale, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsTimeZone } from '../../common/validators/timezone.validator';

export class UpdateUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsOptional()
  displayName?: string;

  @IsLocale()
  @IsOptional()
  locale?: string;

  @IsTimeZone()
  @IsOptional()
  timezone?: string;
}
