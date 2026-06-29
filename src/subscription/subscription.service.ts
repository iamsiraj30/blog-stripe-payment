import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Injectable()
export class SubscriptionService {
  private stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.stripe = new Stripe(
      this.config.get<string>('STRIPE_SECRET_KEY') ?? '',
      { apiVersion: '2026-06-24.dahlia' },
    );
  }

  // Retrieve current logged-in user's subscription
  async findUserSubscription(userId: string) {
    let subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: {
        plan: true,
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found for this user');
    }

    // Dynamically check if active subscription has expired
    if (
      subscription.status === SubscriptionStatus.ACTIVE &&
      subscription.expiresAt < new Date()
    ) {
      subscription = await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.EXPIRED },
        include: {
          plan: true,
          payments: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    }

    return subscription;
  }

  // Cancel subscription for user
  async cancelSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (subscription.status === SubscriptionStatus.CANCELLED) {
      throw new BadRequestException('Subscription is already cancelled');
    }

    // Cancel in Stripe if stripeSubscriptionId exists
    if (subscription.stripeSubscriptionId) {
      try {
        await this.stripe.subscriptions.cancel(
          subscription.stripeSubscriptionId,
        );
      } catch (error: any) {
        // If Stripe subscription is already canceled or not found, log it and proceed to update DB
        console.error(
          'Stripe subscription cancellation failed or already canceled:',
          error.message,
        );
      }
    }

    // Update status in local database
    return this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: SubscriptionStatus.CANCELLED },
      include: { plan: true },
    });
  }

  // Admin: list all subscriptions (with filters + pagination)
  async findAllSubscriptions(query: {
    status?: SubscriptionStatus;
    userId?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, userId, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (userId) {
      where.userId = userId;
    }

    const [data, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        include: {
          plan: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Admin: find single subscription
  async findSubscriptionById(id: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        plan: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  // Admin: manually update subscription parameters
  async updateSubscription(id: string, dto: UpdateSubscriptionDto) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const data: any = {};

    if (dto.status) {
      data.status = dto.status;

      // If updating status to CANCELLED and it was not cancelled before, cancel in Stripe
      if (
        dto.status === SubscriptionStatus.CANCELLED &&
        subscription.status !== SubscriptionStatus.CANCELLED &&
        subscription.stripeSubscriptionId
      ) {
        try {
          await this.stripe.subscriptions.cancel(
            subscription.stripeSubscriptionId,
          );
        } catch (error: any) {
          console.error(
            'Stripe subscription cancellation failed during admin status override:',
            error.message,
          );
        }
      }
    }

    if (dto.expiresAt) {
      data.expiresAt = new Date(dto.expiresAt);
    }

    return this.prisma.subscription.update({
      where: { id },
      data,
      include: { plan: true },
    });
  }
}
