import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  BillingCycle,
  SubscriptionStatus,
  PaymentStatus,
} from '@prisma/client';
import Stripe from 'stripe';

@Injectable()
export class PaymentService {
  private stripe: Stripe;
  private webhookSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.stripe = new Stripe(
      this.config.get<string>('STRIPE_SECRET_KEY') ?? '',
      { apiVersion: '2026-06-24.dahlia' },
    );
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
  }

  // ── Checkout ─────────────────────────────────────────────

  async createCheckoutSession(userId: string, planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Reuse existing Stripe customer if one exists
    let customerId: string | undefined;
    if (user.subscription?.stripeCustomerId) {
      customerId = user.subscription.stripeCustomerId;
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        planId,
      },
      success_url: `${this.config.get<string>('CLIENT_URL') || 'http://localhost:3000'}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.config.get<string>('CLIENT_URL') || 'http://localhost:3000'}/payment/cancel`,
    };

    if (customerId) {
      sessionParams.customer = customerId;
    } else {
      sessionParams.customer_email = user.email;
    }

    try {
      const session = await this.stripe.checkout.sessions.create(sessionParams);

      // Log pending payment
      await this.prisma.payment.create({
        data: {
          userId,
          amount: plan.price,
          currency: plan.currency,
          status: PaymentStatus.PENDING,
          stripeSessionId: session.id,
        },
      });

      return { url: session.url };
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Failed to create checkout session: ${error.message}`,
      );
    }
  }

  // ── Webhook ──────────────────────────────────────────────

  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.webhookSecret,
      );
    } catch (err: any) {
      throw new BadRequestException(
        `Webhook signature verification failed: ${err.message}`,
      );
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;

      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice,
        );
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;

      default:
        break;
    }

    return { received: true };
  }

  // ── Event Handlers ───────────────────────────────────────

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    const planId = session.metadata?.planId;

    if (!userId || !planId) return;

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return;

    const now = new Date();
    const expiresAt = new Date(now);
    if (plan.billingCycle === BillingCycle.MONTHLY) {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    // Upsert the subscription
    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planId,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
        startsAt: now,
        expiresAt,
      },
      update: {
        planId,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
        startsAt: now,
        expiresAt,
      },
    });

    // Update the pending payment record
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    await this.prisma.payment.updateMany({
      where: { stripeSessionId: session.id },
      data: {
        status: PaymentStatus.SUCCESS,
        stripePaymentIntentId: session.payment_intent as string,
        paidAt: now,
        subscriptionId: sub?.id,
      },
    });
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
    // Access subscription id from the invoice object
    const stripeSubscriptionId = (invoice as any).subscription as string;
    if (!stripeSubscriptionId) return;

    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId },
      include: { plan: true },
    });
    if (!subscription) return;

    // Extend expiry
    const newExpiry = new Date(subscription.expiresAt);
    if (subscription.plan.billingCycle === BillingCycle.MONTHLY) {
      newExpiry.setMonth(newExpiry.getMonth() + 1);
    } else {
      newExpiry.setFullYear(newExpiry.getFullYear() + 1);
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        expiresAt: newExpiry,
      },
    });

    // Log renewal payment
    const paymentIntentId = (invoice as any).payment_intent as string;
    await this.prisma.payment.create({
      data: {
        userId: subscription.userId,
        subscriptionId: subscription.id,
        amount: subscription.plan.price,
        currency: subscription.plan.currency,
        status: PaymentStatus.SUCCESS,
        stripePaymentIntentId: paymentIntentId || undefined,
        paidAt: new Date(),
      },
    });
  }

  private async handleSubscriptionDeleted(sub: Stripe.Subscription) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: sub.id },
    });
    if (!subscription) return;

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: SubscriptionStatus.CANCELLED },
    });
  }
}
