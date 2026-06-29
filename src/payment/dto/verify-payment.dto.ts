import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyPaymentDto {
  @ApiProperty({
    example: 'cs_test_a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6',
    description:
      'The Stripe Checkout Session ID received via the success redirect URL query param (session_id)',
  })
  @IsString()
  @IsNotEmpty()
  sessionId: string;
}
