import { IsEmail, IsNotEmpty, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ example: 'john.doe@example.com', description: 'User email' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 123456, description: '6-digit OTP code' })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  otp: number;
}
