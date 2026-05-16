import { DevicePlatform } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsTimeZone } from '../../common/validators/timezone.validator';

export class RegisterDeviceDto {
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  pushProvider?: string | null;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  pushToken?: string | null;

  @IsTimeZone()
  timezone: string;

  @IsString()
  @MaxLength(50)
  @IsOptional()
  appVersion?: string | null;
}
