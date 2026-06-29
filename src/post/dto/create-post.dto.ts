import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { PostStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({ example: 'My First Post', description: 'The title of the post' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'This is the body content of the post.', description: 'The description/body of the post', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: PostStatus, example: PostStatus.ACTIVE, description: 'Status of the post', default: PostStatus.ACTIVE, required: false })
  @IsEnum(PostStatus)
  @IsOptional()
  status?: PostStatus;
}
