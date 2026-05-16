import { IsBoolean, IsHexColor, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCalendarDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsHexColor()
  color: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
