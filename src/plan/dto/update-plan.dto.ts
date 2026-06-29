import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePlanDto {
  @ApiProperty({ example: 'Updated Premium Plan', description: 'The name of the plan', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'Updated details here.', description: 'The details of the subscription tier', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 12, description: 'Updated post creation limit', required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  postLimit?: number;
}
