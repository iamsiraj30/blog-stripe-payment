import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { BillingCycle } from '@prisma/client';
import Stripe from 'stripe';

@Injectable()
export class PlanService {
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

  // ── helpers ──────────────────────────────────────────────

  private billingInterval(cycle: BillingCycle): Stripe.PriceCreateParams.Recurring.Interval {
    return cycle === BillingCycle.MONTHLY ? 'month' : 'year';
  }

  // ── CRUD ─────────────────────────────────────────────────

  async create(dto: CreatePlanDto) {
    try {
      // 1. Create Stripe Product
      const product = await this.stripe.products.create({
        name: dto.name,
        description: dto.description || undefined,
      });

      // 2. Create Stripe Price
      const price = await this.stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(dto.price * 100), // cents
        currency: (dto.currency || 'USD').toLowerCase(),
        recurring: {
          interval: this.billingInterval(dto.billingCycle),
        },
      });

      // 3. Save to database
      return this.prisma.plan.create({
        data: {
          name: dto.name,
          description: dto.description,
          price: dto.price,
          currency: (dto.currency || 'USD').toUpperCase(),
          billingCycle: dto.billingCycle,
          postLimit: dto.postLimit,
          stripePriceId: price.id,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to create plan: ${error.message}`,
      );
    }
  }

  async findAll() {
    return this.prisma.plan.findMany({
      orderBy: { price: 'asc' },
    });
  }

  async findOne(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    return plan;
  }

  async update(id: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    // Update Stripe product name/description if changed
    if (dto.name || dto.description) {
      const stripePrice = await this.stripe.prices.retrieve(plan.stripePriceId);
      await this.stripe.products.update(stripePrice.product as string, {
        ...(dto.name && { name: dto.name }),
        ...(dto.description && { description: dto.description }),
      });
    }

    return this.prisma.plan.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    // Deactivate price and product in Stripe (Stripe prices cannot be deleted)
    try {
      await this.stripe.prices.update(plan.stripePriceId, { active: false });
      const stripePrice = await this.stripe.prices.retrieve(plan.stripePriceId);
      await this.stripe.products.update(stripePrice.product as string, {
        active: false,
      });
    } catch (error) {
      // log but don't block local deletion
      console.error('Stripe deactivation warning:', error.message);
    }

    await this.prisma.plan.delete({ where: { id } });
    return { message: 'Plan deleted successfully' };
  }
}
