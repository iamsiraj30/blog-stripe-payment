import { IsEnum, IsDateString, IsOptional } from 'class-validator';
import { SubscriptionStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSubscriptionDto {
  @ApiProperty({
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ACTIVE,
    description: 'The status of the subscription',
    required: false,
  })
  @IsEnum(SubscriptionStatus)
  @IsOptional()
  status?: SubscriptionStatus;

  @ApiProperty({
    example: '2026-12-31T23:59:59.000Z',
    description: 'The expiration date of the subscription',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
