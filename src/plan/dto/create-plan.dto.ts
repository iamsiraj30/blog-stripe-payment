import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsPositive,
  IsInt,
  IsEnum,
  Min,
} from 'class-validator';
import { BillingCycle } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePlanDto {
  @ApiProperty({ example: 'Premium Plan', description: 'The name of the plan' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'Plan allowing up to 10 posts.',
    description: 'The details of the plan',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 9.99, description: 'Price of the plan' })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiProperty({
    example: 'USD',
    description: 'Three-letter currency code',
    default: 'USD',
    required: false,
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({
    enum: BillingCycle,
    example: BillingCycle.MONTHLY,
    description: 'Billing frequency',
  })
  @IsEnum(BillingCycle)
  billingCycle: BillingCycle;

  @ApiProperty({
    example: 10,
    description: 'Maximum number of posts allowed under this plan',
  })
  @IsInt()
  @Min(1)
  postLimit: number;
}
