import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CheckoutDto } from './dto/checkout.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiConsumes,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Payments & Subscriptions')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // ── POST /payments/checkout ───────────────────────────────

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  @ApiOperation({
    summary: 'Create a Stripe Checkout session',
    description:
      'Generates a Stripe-hosted Checkout page URL for the specified plan. ' +
      'Redirect the user to the returned `url`. After payment, Stripe redirects ' +
      'to `success_url` — then call `POST /payments/verify` with the `session_id`.',
  })
  @ApiBody({ type: CheckoutDto })
  @ApiResponse({
    status: 201,
    description: 'Checkout session created. Returns Stripe redirect URL.',
    schema: {
      example: {
        url: 'https://checkout.stripe.com/c/pay/cs_test_a1B2...',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error on request body.',
  })
  @ApiResponse({ status: 404, description: 'Plan not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token.' })
  checkout(@CurrentUser('id') userId: string, @Body() dto: CheckoutDto) {
    return this.paymentService.createCheckoutSession(userId, dto.planId);
  }

  // ── POST /payments/verify ─────────────────────────────────

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify a Stripe Checkout session and activate subscription',
    description:
      'Call this endpoint from the payment success page, passing the `session_id` ' +
      'from the redirect URL query param. It confirms the payment with Stripe, then ' +
      "creates or updates the user's subscription record and returns the active subscription.",
  })
  @ApiBody({ type: VerifyPaymentDto })
  @ApiResponse({
    status: 200,
    description: 'Payment verified. Returns the activated subscription.',
    schema: {
      example: {
        id: 'f4e2a1c0-1234-5678-abcd-ef0123456789',
        userId: 'a1b2c3d4-...',
        planId: 'e5f6g7h8-...',
        status: 'ACTIVE',
        stripeCustomerId: 'cus_XXXXXXXX',
        stripeSubscriptionId: 'sub_XXXXXXXX',
        startsAt: '2026-06-29T00:00:00.000Z',
        expiresAt: '2026-07-29T00:00:00.000Z',
        plan: {
          id: 'e5f6g7h8-...',
          name: 'Premium Plan',
          price: '9.99',
          billingCycle: 'MONTHLY',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid session ID or payment not completed.',
  })
  verify(@Body() dto: VerifyPaymentDto) {
    return this.paymentService.verifySession(dto.sessionId);
  }

  // ── POST /payments/webhook ────────────────────────────────

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('application/json')
  @ApiOperation({
    summary: 'Stripe Webhook receiver',
    description:
      'Receives and processes real-time Stripe events (e.g. `checkout.session.completed`, ' +
      '`invoice.payment_succeeded`, `customer.subscription.deleted`). ' +
      '**Do not call this manually.** Configure this URL in your Stripe Dashboard webhook settings. ' +
      'Requires the raw request body and the `stripe-signature` header for signature verification.',
  })
  @ApiHeader({
    name: 'stripe-signature',
    required: true,
    description:
      'HMAC signature provided by Stripe in the `Stripe-Signature` header',
    example: 't=1609459200,v1=abc123...',
  })
  @ApiBody({
    description:
      'Raw Stripe event JSON payload — must be forwarded without modification.',
    schema: {
      type: 'object',
      example: {
        id: 'evt_1XXXXXXXX',
        type: 'checkout.session.completed',
        data: { object: {} },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook event received and processed.',
  })
  @ApiResponse({
    status: 400,
    description: 'Signature verification failed or missing raw body.',
  })
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException(
        'Missing raw body for webhook verification',
      );
    }
    return this.paymentService.handleWebhook(req.rawBody, signature);
  }
}
