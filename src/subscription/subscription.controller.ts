import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { ListSubscriptionsDto } from './dto/list-subscriptions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';

const subscriptionExample = {
  id: 'f4e2a1c0-1234-5678-abcd-ef0123456789',
  userId: 'a1b2c3d4-0000-0000-0000-000000000001',
  planId: 'e5f6g7h8-0000-0000-0000-000000000002',
  status: 'ACTIVE',
  stripeCustomerId: 'cus_XXXXXXXX',
  stripeSubscriptionId: 'sub_XXXXXXXX',
  startsAt: '2026-06-29T00:00:00.000Z',
  expiresAt: '2026-07-29T00:00:00.000Z',
  createdAt: '2026-06-29T00:00:00.000Z',
  updatedAt: '2026-06-29T00:00:00.000Z',
  plan: {
    id: 'e5f6g7h8-0000-0000-0000-000000000002',
    name: 'Premium Plan',
    price: '9.99',
    currency: 'USD',
    billingCycle: 'MONTHLY',
    postLimit: 50,
  },
  payments: [
    {
      id: 'pay-001',
      amount: '9.99',
      currency: 'USD',
      status: 'SUCCESS',
      paidAt: '2026-06-29T00:00:00.000Z',
    },
  ],
};

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // ── GET /subscriptions/me ─────────────────────────────────

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({
    summary: "Get the current user's subscription",
    description:
      'Returns the full subscription record for the authenticated user, including plan details ' +
      'and payment history. If the subscription has passed its expiry date, the status is ' +
      'automatically transitioned to `EXPIRED` before returning.',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription retrieved successfully.',
    schema: { example: subscriptionExample },
  })
  @ApiResponse({
    status: 404,
    description: 'No subscription found for this user.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token.' })
  findMySubscription(@CurrentUser('id') userId: string) {
    return this.subscriptionService.findUserSubscription(userId);
  }

  // ── POST /subscriptions/cancel ────────────────────────────

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Cancel the current user's subscription",
    description:
      "Immediately cancels the authenticated user's active Stripe subscription and " +
      'sets the local subscription status to `CANCELLED`. Returns the updated subscription record.',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription cancelled successfully.',
    schema: {
      example: {
        ...subscriptionExample,
        status: 'CANCELLED',
        payments: undefined,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Subscription is already cancelled.',
  })
  @ApiResponse({ status: 404, description: 'Subscription not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token.' })
  cancelMySubscription(@CurrentUser('id') userId: string) {
    return this.subscriptionService.cancelSubscription(userId);
  }

  // ── GET /subscriptions  (Admin) ───────────────────────────

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  @ApiOperation({
    summary: 'List all subscriptions (Admin)',
    description:
      'Returns a paginated, filterable list of every subscription in the system, ' +
      'each including the associated user (id, name, email) and plan details. ' +
      'Accessible by `ADMIN` role only.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING'],
    description: 'Filter by subscription status',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: String,
    description: 'Filter by a specific user UUID',
    example: 'a1b2c3d4-0000-0000-0000-000000000001',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
    description: 'Items per page (default: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of subscriptions.',
    schema: {
      example: {
        data: [
          {
            ...subscriptionExample,
            payments: undefined,
            user: {
              id: 'a1b2c3d4-...',
              name: 'Sirajul Islam',
              email: 'user@example.com',
            },
          },
        ],
        meta: { total: 1, page: 1, limit: 10, pages: 1 },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Admin privileges required.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token.' })
  findAll(@Query() query: ListSubscriptionsDto) {
    return this.subscriptionService.findAllSubscriptions(query);
  }

  // ── GET /subscriptions/:id  (Admin) ──────────────────────

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get(':id')
  @ApiOperation({
    summary: 'Get a specific subscription by ID (Admin)',
    description:
      'Returns full details for the given subscription UUID, including user info, ' +
      'plan details, and full payment history. Accessible by `ADMIN` role only.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the Subscription',
    example: 'f4e2a1c0-1234-5678-abcd-ef0123456789',
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription details retrieved successfully.',
    schema: {
      example: {
        ...subscriptionExample,
        user: {
          id: 'a1b2c3d4-...',
          name: 'Sirajul Islam',
          email: 'user@example.com',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Subscription not found.' })
  @ApiForbiddenResponse({ description: 'Admin privileges required.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token.' })
  findOne(@Param('id') id: string) {
    return this.subscriptionService.findSubscriptionById(id);
  }

  // ── PATCH /subscriptions/:id  (Admin) ────────────────────

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({
    summary: 'Manually update subscription parameters (Admin)',
    description:
      'Allows an admin to manually override the `status` and/or `expiresAt` of any subscription. ' +
      'If status is changed to `CANCELLED` and a Stripe subscription ID exists, ' +
      'the cancellation is also propagated to Stripe. Accessible by `ADMIN` role only.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the Subscription',
    example: 'f4e2a1c0-1234-5678-abcd-ef0123456789',
  })
  @ApiBody({ type: UpdateSubscriptionDto })
  @ApiResponse({
    status: 200,
    description: 'Subscription updated successfully.',
    schema: {
      example: {
        ...subscriptionExample,
        status: 'ACTIVE',
        expiresAt: '2027-06-29T00:00:00.000Z',
        payments: undefined,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error on request body.',
  })
  @ApiResponse({ status: 404, description: 'Subscription not found.' })
  @ApiForbiddenResponse({ description: 'Admin privileges required.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT token.' })
  update(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.subscriptionService.updateSubscription(id, dto);
  }
}
