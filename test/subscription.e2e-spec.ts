import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role, SubscriptionStatus, BillingCycle } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const mockCancel = jest
  .fn()
  .mockResolvedValue({ id: 'sub_test_123', status: 'canceled' });
const mockRetrieveSession = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => {
    return {
      subscriptions: {
        cancel: mockCancel,
      },
      checkout: {
        sessions: {
          retrieve: mockRetrieveSession,
        },
      },
    };
  });
});

describe('SubscriptionController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userToken: string;
  let adminToken: string;
  let userId: string;
  let planId: string;
  let subscriptionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('/api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    // Clean up existing test data if any
    await prisma.payment.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.post.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.plan.deleteMany({});

    // Seed test plan
    const plan = await prisma.plan.create({
      data: {
        name: 'E2E Premium Plan',
        description: 'Premium plan for E2E tests',
        price: 9.99,
        currency: 'USD',
        billingCycle: BillingCycle.MONTHLY,
        postLimit: 50,
        stripePriceId: 'price_e2e_premium_test',
      },
    });
    planId = plan.id;

    // Seed test users
    const passwordHash = await bcrypt.hash('Test@123', 10);

    const user = await prisma.user.create({
      data: {
        name: 'E2E User',
        email: 'e2e-user@example.com',
        password: passwordHash,
        isVerified: true,
        role: Role.USER,
      },
    });
    userId = user.id;

    await prisma.user.create({
      data: {
        name: 'E2E Admin',
        email: 'e2e-admin@example.com',
        password: passwordHash,
        isVerified: true,
        role: Role.ADMIN,
      },
    });

    // Authenticate and get tokens
    const userLoginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'e2e-user@example.com', password: 'Test@123' })
      .expect(200);
    userToken = userLoginResponse.body.accessToken;

    const adminLoginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'e2e-admin@example.com', password: 'Test@123' })
      .expect(200);
    adminToken = adminLoginResponse.body.accessToken;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.payment.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.plan.deleteMany({});
    await app.close();
  });

  describe('GET /subscriptions/me', () => {
    it('should return 401 if unauthorized', () => {
      return request(app.getHttpServer())
        .get('/api/v1/subscriptions/me')
        .expect(401);
    });

    it('should return 404 if no subscription exists for user', () => {
      return request(app.getHttpServer())
        .get('/api/v1/subscriptions/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });

    it('should return 200 with subscription details after creation', async () => {
      // Seed a subscription directly in DB
      const sub = await prisma.subscription.create({
        data: {
          userId,
          planId,
          status: SubscriptionStatus.ACTIVE,
          stripeSubscriptionId: 'sub_e2e_test_123',
          stripeCustomerId: 'cus_e2e_test_123',
          startsAt: new Date(),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        },
      });
      subscriptionId = sub.id;

      const res = await request(app.getHttpServer())
        .get('/api/v1/subscriptions/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('id', subscriptionId);
      expect(res.body.plan).toHaveProperty('id', planId);
      expect(res.body.status).toBe(SubscriptionStatus.ACTIVE);
    });
  });

  describe('POST /subscriptions/cancel', () => {
    it('should return 401 if unauthorized', () => {
      return request(app.getHttpServer())
        .post('/api/v1/subscriptions/cancel')
        .expect(401);
    });

    it('should cancel the active subscription and update status in DB', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/subscriptions/cancel')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.status).toBe(SubscriptionStatus.CANCELLED);
      expect(mockCancel).toHaveBeenCalledWith('sub_e2e_test_123');

      // Verify status in DB
      const dbSub = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });
      expect(dbSub.status).toBe(SubscriptionStatus.CANCELLED);
    });

    it('should return 400 if subscription is already cancelled', () => {
      return request(app.getHttpServer())
        .post('/api/v1/subscriptions/cancel')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);
    });
  });

  describe('Admin Operations', () => {
    describe('GET /subscriptions', () => {
      it('should return 403 for non-admin users', () => {
        return request(app.getHttpServer())
          .get('/api/v1/subscriptions')
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });

      it('should return 200 with subscription list for admins', async () => {
        const res = await request(app.getHttpServer())
          .get('/api/v1/subscriptions')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        expect(res.body.data[0]).toHaveProperty('user');
        expect(res.body.data[0].user).toHaveProperty(
          'email',
          'e2e-user@example.com',
        );
      });
    });

    describe('GET /subscriptions/:id', () => {
      it('should return 403 for non-admin users', () => {
        return request(app.getHttpServer())
          .get(`/api/v1/subscriptions/${subscriptionId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);
      });

      it('should return 200 with subscription details for admins', async () => {
        const res = await request(app.getHttpServer())
          .get(`/api/v1/subscriptions/${subscriptionId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body).toHaveProperty('id', subscriptionId);
        expect(res.body).toHaveProperty('user');
        expect(res.body.user).toHaveProperty('email', 'e2e-user@example.com');
      });

      it('should return 404 for non-existent subscription', () => {
        return request(app.getHttpServer())
          .get('/api/v1/subscriptions/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      });
    });

    describe('PATCH /subscriptions/:id', () => {
      it('should return 403 for non-admin users', () => {
        return request(app.getHttpServer())
          .patch(`/api/v1/subscriptions/${subscriptionId}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ status: SubscriptionStatus.ACTIVE })
          .expect(403);
      });

      it('should manually update subscription parameters for admins', async () => {
        const futureDate = new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 365,
        ).toISOString();
        const res = await request(app.getHttpServer())
          .patch(`/api/v1/subscriptions/${subscriptionId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            status: SubscriptionStatus.ACTIVE,
            expiresAt: futureDate,
          })
          .expect(200);

        expect(res.body.status).toBe(SubscriptionStatus.ACTIVE);
        expect(new Date(res.body.expiresAt).toISOString()).toBe(futureDate);

        // Verify database state
        const dbSub = await prisma.subscription.findUnique({
          where: { id: subscriptionId },
        });
        expect(dbSub.status).toBe(SubscriptionStatus.ACTIVE);
      });
    });
  });

  describe('POST /payments/verify', () => {
    it('should return 400 if sessionId is missing', () => {
      return request(app.getHttpServer())
        .post('/api/v1/payments/verify')
        .send({})
        .expect(400);
    });

    it('should successfully verify checkout session and create/update subscription', async () => {
      mockRetrieveSession.mockResolvedValue({
        id: 'cs_e2e_verify_999',
        payment_status: 'paid',
        customer: 'cus_e2e_verify_999',
        subscription: 'sub_e2e_verify_999',
        payment_intent: 'pi_e2e_verify_999',
        metadata: {
          userId,
          planId,
        },
      });

      // Clear existing subscription first so we verify it gets created
      await prisma.subscription.deleteMany({ where: { userId } });

      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/verify')
        .send({ sessionId: 'cs_e2e_verify_999' })
        .expect(200);

      expect(res.body.status).toBe(SubscriptionStatus.ACTIVE);
      expect(res.body.stripeSubscriptionId).toBe('sub_e2e_verify_999');

      // Verify DB record
      const dbSub = await prisma.subscription.findUnique({ where: { userId } });
      expect(dbSub).toBeDefined();
      expect(dbSub?.status).toBe(SubscriptionStatus.ACTIVE);
    });
  });
});
