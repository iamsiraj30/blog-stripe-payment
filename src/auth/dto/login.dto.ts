import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'sirazclan@gmail.com', description: 'User email' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456', description: 'User password' })
  @IsNotEmpty()
  @IsString()
  password: string;
}
