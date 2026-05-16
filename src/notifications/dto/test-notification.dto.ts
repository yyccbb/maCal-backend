import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TestNotificationDto {
  @IsString()
  @MaxLength(120)
  @IsOptional()
  title?: string;

  @IsString()
  @MaxLength(240)
  @IsOptional()
  body?: string;
}
