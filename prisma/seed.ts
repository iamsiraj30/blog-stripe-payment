import { PrismaClient, Role, BillingCycle } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as bcrypt from 'bcrypt';

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log('🌱 Seeding database...');

  // ── 1. Seed Admin User ────────────────────────────────────
  const adminEmail = 'admin@example.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    await prisma.user.create({
      data: {
        name: 'Admin User',
        email: adminEmail,
        password: hashedPassword,
        isVerified: true,
        role: Role.ADMIN,
      },
    });
    console.log('✅ Admin user created: admin@example.com / Admin@123');
  } else {
    console.log('ℹ️  Admin user already exists');
  }

  // ── 2. Seed Regular User ──────────────────────────────────
  const userEmail = 'user@example.com';
  const existingUser = await prisma.user.findUnique({ where: { email: userEmail } });

  if (!existingUser) {
    const hashedPassword = await bcrypt.hash('User@123', 10);
    await prisma.user.create({
      data: {
        name: 'Regular User',
        email: userEmail,
        password: hashedPassword,
        isVerified: true,
        role: Role.USER,
      },
    });
    console.log('✅ Regular user created: user@example.com / User@123');
  } else {
    console.log('ℹ️  Regular user already exists');
  }

  // ── 3. Seed Premium Plan (with mock Stripe ID) ────────────
  const premiumPlanName = 'Premium';
  const existingPlan = await prisma.plan.findUnique({ where: { name: premiumPlanName } });

  if (!existingPlan) {
    await prisma.plan.create({
      data: {
        name: premiumPlanName,
        description: 'Premium plan with 10 post limit',
        price: 9.99,
        currency: 'USD',
        billingCycle: BillingCycle.MONTHLY,
        postLimit: 10,
        stripePriceId: 'price_mock_premium_seed',
      },
    });
    console.log('✅ Premium plan seeded (mock stripePriceId — replace via Admin API for real Stripe integration)');
  } else {
    console.log('ℹ️  Premium plan already exists');
  }

  console.log('🌱 Seeding complete!');

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
