import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsString,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'john.doe@example.com', description: 'User email' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 123456, description: '6-digit OTP code' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  otp: number;

  @ApiProperty({
    example: 'newpassword123',
    description: 'New password (min 6 characters)',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  newPassword: string;
}
