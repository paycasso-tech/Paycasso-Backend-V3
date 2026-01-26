import { IsEmail, IsString, Length, Matches, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6)
  otp: string;

  @ApiProperty({ example: 'NewSecurePass123!' })
  @IsString()
  @Length(8, 100)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'Password must contain uppercase, lowercase, number, and special character',
  })
  new_password: string;

  @ApiProperty({ example: 'NewSecurePass123!' })
  @IsString()
  confirm_password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'refresh_token_string' })
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}

export class DeleteAccountDto {
  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  password: string;

  @ApiProperty({ example: 'DELETE MY ACCOUNT' })
  @IsString()
  @Matches(/^DELETE MY ACCOUNT$/, { message: 'Confirmation must match exactly' })
  confirmation: string;
}
