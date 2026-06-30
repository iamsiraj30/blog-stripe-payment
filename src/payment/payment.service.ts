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
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
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

    sessionParams.customer_email = user.email;

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

  // ── Session Verification (Fallback) ──────────────────────

  async verifySession(sessionId: string) {
    let session: Stripe.Checkout.Session;
    try {
      session = await this.stripe.checkout.sessions.retrieve(sessionId);
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to retrieve checkout session: ${error.message}`,
      );
    }

    if (session.payment_status !== 'paid') {
      throw new BadRequestException(
        'Payment has not been completed for this session',
      );
    }

    // Process checkout session completion
    await this.handleCheckoutCompleted(session);

    const userId = session.metadata?.userId;
    if (!userId) {
      throw new BadRequestException('Invalid session metadata');
    }

    return this.prisma.payment.findFirst({
      where: { stripeSessionId: sessionId },
    });
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
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
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

    // Update the pending payment record
    await this.prisma.payment.updateMany({
      where: { stripeSessionId: session.id },
      data: {
        status: PaymentStatus.SUCCESS,
        stripePaymentIntentId: session.payment_intent as string,
        paidAt: now,
      },
    });
  }
}
