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
} from '@nestjs/swagger';

@ApiTags('Payments & Subscriptions')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  @ApiOperation({
    summary: 'Create a Stripe checkout session for a subscription',
  })
  @ApiResponse({
    status: 200,
    description: 'Stripe Checkout Session URL generated successfully.',
  })
  @ApiResponse({ status: 404, description: 'Plan not found.' })
  checkout(@CurrentUser('id') userId: string, @Body() dto: CheckoutDto) {
    return this.paymentService.createCheckoutSession(userId, dto.planId);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stripe Webhook endpoint for processing system events',
  })
  @ApiBody({ description: 'Raw Stripe event data payload' })
  @ApiResponse({
    status: 200,
    description: 'Webhook events processed successfully.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid signature verification or payload.',
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
