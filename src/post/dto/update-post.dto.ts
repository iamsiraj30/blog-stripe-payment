import { IsString, IsOptional, IsEnum } from 'class-validator';
import { PostStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePostDto {
  @ApiProperty({ example: 'Updated Title', description: 'The title of the post', required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ example: 'Updated description content.', description: 'The description/body of the post', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: PostStatus, example: PostStatus.INACTIVE, description: 'Status of the post', required: false })
  @IsEnum(PostStatus)
  @IsOptional()
  status?: PostStatus;
}
