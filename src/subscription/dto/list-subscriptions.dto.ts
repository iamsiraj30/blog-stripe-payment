import { IsEnum, IsUUID, IsOptional, IsInt, Min } from 'class-validator';
import { SubscriptionStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ListSubscriptionsDto {
  @ApiProperty({
    enum: SubscriptionStatus,
    required: false,
    description: 'Filter subscriptions by status',
  })
  @IsEnum(SubscriptionStatus)
  @IsOptional()
  status?: SubscriptionStatus;

  @ApiProperty({
    required: false,
    description: 'Filter subscriptions by user ID',
  })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty({
    required: false,
    default: 1,
    description: 'Pagination page number',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({
    required: false,
    default: 10,
    description: 'Pagination page size/limit',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;
}
