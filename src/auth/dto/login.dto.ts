import { IsNotEmpty, Matches, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @Matches(/^[a-zA-Z0-9_.-]{3,50}$/, {
    message: 'account must be 3-50 characters and use only letters, numbers, underscore, dot, or dash',
  })
  account: string;

  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  password: string;
}
