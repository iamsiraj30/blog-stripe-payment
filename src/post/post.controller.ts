import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Posts')
@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Create a new post' })
  @ApiResponse({ status: 201, description: 'Post successfully created.' })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden. Post creation limit reached.',
  })
  create(@CurrentUser('id') userId: string, @Body() dto: CreatePostDto) {
    return this.postService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve all active posts' })
  @ApiResponse({
    status: 200,
    description: 'List of all active posts retrieved successfully.',
  })
  findAll() {
    return this.postService.findAll();
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('my-posts')
  @ApiOperation({ summary: 'Retrieve all posts created by the current user' })
  @ApiResponse({
    status: 200,
    description: 'List of user posts retrieved successfully.',
  })
  findMyPosts(@CurrentUser('id') userId: string) {
    return this.postService.findMyPosts(userId);
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Retrieve a single post by ID or Slug' })
  @ApiParam({ name: 'idOrSlug', description: 'The post ID or Unique slug' })
  @ApiResponse({
    status: 200,
    description: 'Post details retrieved successfully.',
  })
  @ApiResponse({ status: 404, description: 'Post not found.' })
  findOne(@Param('idOrSlug') idOrSlug: string) {
    return this.postService.findOne(idOrSlug);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a post (Author only)' })
  @ApiParam({ name: 'id', description: 'The UUID of the post' })
  @ApiResponse({ status: 200, description: 'Post updated successfully.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Only the author can update the post.',
  })
  @ApiResponse({ status: 404, description: 'Post not found.' })
  update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postService.update(id, userId, dto);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a post (Author or Admin)' })
  @ApiParam({ name: 'id', description: 'The UUID of the post' })
  @ApiResponse({ status: 200, description: 'Post deleted successfully.' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Only the author or an admin can delete.',
  })
  @ApiResponse({ status: 404, description: 'Post not found.' })
  remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: Role,
  ) {
    return this.postService.remove(id, userId, userRole);
  }
}
