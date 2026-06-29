import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckoutDto {
  @ApiProperty({
    example: '85e05a8f-2875-4d04-8935-cfbfeb7ff05b',
    description: 'The unique ID of the Plan to subscribe to',
  })
  @IsString()
  @IsNotEmpty()
  planId: string;
}
