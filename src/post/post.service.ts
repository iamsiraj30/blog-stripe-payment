import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Role, SubscriptionStatus } from '@prisma/client';

const FREE_POST_LIMIT = 5;

@Injectable()
export class PostService {
  constructor(private readonly prisma: PrismaService) {}

  // ── helpers ──────────────────────────────────────────────

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    let slug = base;
    let counter = 0;
    while (true) {
      const existing = await this.prisma.post.findUnique({
        where: { slug },
      });
      if (!existing || existing.id === excludeId) return slug;
      counter++;
      slug = `${base}-${counter}`;
    }
  }

  private async enforcePostLimit(userId: string): Promise<void> {
    const postCount = await this.prisma.post.count({
      where: { authorId: userId },
    });

    // Check for an active subscription
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    let limit = FREE_POST_LIMIT;
    if (
      subscription &&
      subscription.status === SubscriptionStatus.ACTIVE &&
      subscription.expiresAt > new Date()
    ) {
      limit = subscription.plan.postLimit;
    }

    if (postCount >= limit) {
      throw new ForbiddenException(
        `Post creation limit reached (${limit}). Please upgrade your plan.`,
      );
    }
  }

  // ── CRUD ─────────────────────────────────────────────────

  async create(userId: string, dto: CreatePostDto) {
    await this.enforcePostLimit(userId);

    const baseSlug = this.generateSlug(dto.title);
    const slug = await this.uniqueSlug(baseSlug);

    return this.prisma.post.create({
      data: {
        title: dto.title,
        slug,
        description: dto.description,
        status: dto.status,
        authorId: userId,
      },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
  }

  async findAll() {
    return this.prisma.post.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
  }

  async findMyPosts(userId: string) {
    return this.prisma.post.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
  }

  async findOne(idOrSlug: string) {
    const post = await this.prisma.post.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: { author: { select: { id: true, name: true, email: true } } },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }

  async update(postId: string, userId: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only update your own posts');
    }

    const data: Record<string, any> = { ...dto };

    // regenerate slug if title changed
    if (dto.title) {
      const baseSlug = this.generateSlug(dto.title);
      data.slug = await this.uniqueSlug(baseSlug, postId);
    }

    return this.prisma.post.update({
      where: { id: postId },
      data,
      include: { author: { select: { id: true, name: true, email: true } } },
    });
  }

  async remove(postId: string, userId: string, userRole: Role) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Admin can delete any post; otherwise only the author
    if (post.authorId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException(
        'You do not have permission to delete this post',
      );
    }

    await this.prisma.post.delete({ where: { id: postId } });
    return { message: 'Post deleted successfully' };
  }
}
