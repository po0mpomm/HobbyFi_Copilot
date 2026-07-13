/**
 * Prisma seed script: populates realistic Phase 1 test data.
 * Run with: npx ts-node src/seed.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Users ───────────────────────────────────────────────────────────────────
  const user1 = await prisma.users.upsert({
    where: { user_id: 'user-001' },
    update: {},
    create: {
      user_id: 'user-001', name: 'Rahul Sharma', phone: '9876543210',
      email: 'rahul@example.com', city: 'Mumbai', hobbies: ['badminton', 'cricket'],
    },
  });
  const user2 = await prisma.users.upsert({
    where: { user_id: 'user-002' },
    update: {},
    create: {
      user_id: 'user-002', name: 'Priya Singh', phone: '8765432109',
      email: 'priya@example.com', city: 'Mumbai', hobbies: ['swimming', 'yoga'],
    },
  });
  const user3 = await prisma.users.upsert({
    where: { user_id: 'user-003' },
    update: {},
    create: {
      user_id: 'user-003', name: 'Amit Patel', phone: '7654321098',
      email: 'amit@example.com', city: 'Mumbai', hobbies: ['football'],
    },
  });

  // ── Play-Track Vendor ──────────────────────────────────────────────────────
  const playVendor = await prisma.vendors.upsert({
    where: { vendor_id: 'vendor-play-001' },
    update: {},
    create: {
      vendor_id: 'vendor-play-001', business_name: 'SportZone Courts',
      track: 'play', category: 'sports_court', contact_email: 'admin@sportzone.com',
      phone: '9000000001', onboarding_status: 'live',
      pan_number: 'ABCDE1234F', gst_number: '27ABCDE1234F1Z5',
      bank_account: { account: '123456789', ifsc: 'HDFC0001234' },
    },
  });

  const playVenue1 = await prisma.venues.upsert({
    where: { venue_id: 'venue-play-001' },
    update: {},
    create: {
      venue_id: 'venue-play-001', vendor_id: playVendor.vendor_id,
      name: 'SportZone Andheri', city: 'Mumbai', address: '12 Andheri East',
      sports_offered: ['badminton', 'squash'], amenities: ['parking', 'shower'],
    },
  });

  const slot1 = await prisma.courts_or_slots.upsert({
    where: { slot_id: 'slot-001' },
    update: {},
    create: {
      slot_id: 'slot-001', venue_id: playVenue1.venue_id, sport: 'badminton',
      capacity: 10, price_per_hour: 600, is_active: true,
    },
  });

  const slot2 = await prisma.courts_or_slots.upsert({
    where: { slot_id: 'slot-002' },
    update: {},
    create: {
      slot_id: 'slot-002', venue_id: playVenue1.venue_id, sport: 'squash',
      capacity: 4, price_per_hour: 500, is_active: true,
    },
  });

  // Bookings
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  await prisma.bookings.upsert({
    where: { booking_id: 'booking-001' },
    update: {},
    create: {
      booking_id: 'booking-001', slot_id: slot1.slot_id, venue_id: playVenue1.venue_id,
      sport: 'badminton', booked_by_user_id: user1.user_id, booking_date: yesterday,
      start_time: new Date('2025-01-01T09:00:00'), end_time: new Date('2025-01-01T10:00:00'),
      status: 'completed', total_amount: 600, split_type: 'solo',
    },
  });

  await prisma.bookings.upsert({
    where: { booking_id: 'booking-002' },
    update: {},
    create: {
      booking_id: 'booking-002', slot_id: slot1.slot_id, venue_id: playVenue1.venue_id,
      sport: 'badminton', booked_by_user_id: user2.user_id, booking_date: today,
      start_time: new Date('2025-01-01T11:00:00'), end_time: new Date('2025-01-01T12:00:00'),
      status: 'confirmed', total_amount: 600, split_type: 'solo',
    },
  });

  await prisma.bookings.upsert({
    where: { booking_id: 'booking-003' },
    update: {},
    create: {
      booking_id: 'booking-003', slot_id: slot2.slot_id, venue_id: playVenue1.venue_id,
      sport: 'squash', booked_by_user_id: user3.user_id, booking_date: tomorrow,
      start_time: new Date('2025-01-01T14:00:00'), end_time: new Date('2025-01-01T15:00:00'),
      status: 'confirmed', total_amount: 500, split_type: 'solo',
    },
  });

  // Transactions
  await prisma.transactions.createMany({
    skipDuplicates: true,
    data: [
      { transaction_id: 'txn-001', vendor_id: playVendor.vendor_id, venue_id: playVenue1.venue_id, related_booking_id: 'booking-001', amount: 600, payment_gateway: 'razorpay', status: 'success' },
      { transaction_id: 'txn-002', vendor_id: playVendor.vendor_id, venue_id: playVenue1.venue_id, related_booking_id: 'booking-002', amount: 600, payment_gateway: 'razorpay', status: 'success' },
    ],
  });

  // Payouts
  await prisma.payouts.upsert({
    where: { payout_id: 'payout-001' },
    update: {},
    create: {
      payout_id: 'payout-001', vendor_id: playVendor.vendor_id, venue_id: playVenue1.venue_id,
      period_start: new Date('2025-01-01'), period_end: new Date('2025-01-31'),
      gross_amount: 1200, commission_deducted: 120, net_amount: 1080,
      status: 'settled', settled_at: new Date('2025-02-05'),
    },
  });

  // ── Pass-Track Vendor ──────────────────────────────────────────────────────
  const passVendor = await prisma.vendors.upsert({
    where: { vendor_id: 'vendor-pass-001' },
    update: {},
    create: {
      vendor_id: 'vendor-pass-001', business_name: 'FitLife Studio',
      track: 'pass', category: 'fitness_studio', contact_email: 'admin@fitlife.com',
      phone: '9000000002', onboarding_status: 'live',
      pan_number: 'XYZAB5678G', gst_number: '27XYZAB5678G1Z5',
      bank_account: { account: '987654321', ifsc: 'ICIC0004567' },
    },
  });

  const passVenue = await prisma.venues.upsert({
    where: { venue_id: 'venue-pass-001' },
    update: {},
    create: {
      venue_id: 'venue-pass-001', vendor_id: passVendor.vendor_id,
      name: 'FitLife Bandra', city: 'Mumbai', address: '5 Bandra West',
      sports_offered: ['yoga', 'zumba', 'crossfit'], amenities: ['ac', 'locker'],
    },
  });

  // Plans
  const plan1 = await prisma.membership_plans.upsert({
    where: { plan_id: 'plan-001' },
    update: {},
    create: {
      plan_id: 'plan-001', venue_id: passVenue.venue_id, sport: 'yoga',
      plan_name: 'Monthly Yoga', duration_days: 30, price: 3000,
      trial_available: true, trial_duration_days: 3,
    },
  });

  const plan2 = await prisma.membership_plans.upsert({
    where: { plan_id: 'plan-002' },
    update: {},
    create: {
      plan_id: 'plan-002', venue_id: passVenue.venue_id, sport: 'crossfit',
      plan_name: '10-Class CrossFit Pass', class_count: 10, price: 5000,
    },
  });

  // Memberships — mix of active, expired, trial
  const startActive = new Date(); startActive.setDate(startActive.getDate() - 10);
  const endActive = new Date(); endActive.setDate(endActive.getDate() + 20);
  const startExpired = new Date('2025-01-01');
  const endExpired = new Date('2025-01-31');

  await prisma.memberships.upsert({
    where: { membership_id: 'mem-001' },
    update: {},
    create: {
      membership_id: 'mem-001', plan_id: plan1.plan_id, user_id: user1.user_id,
      venue_id: passVenue.venue_id, start_date: startActive, end_date: endActive,
      status: 'active', is_trial: false, payment_mode: 'auto_paid', display_status: 'Auto-Paid',
    },
  });

  await prisma.memberships.upsert({
    where: { membership_id: 'mem-002' },
    update: {},
    create: {
      membership_id: 'mem-002', plan_id: plan2.plan_id, user_id: user2.user_id,
      venue_id: passVenue.venue_id, start_date: startExpired, end_date: endExpired,
      status: 'expired', is_trial: false, payment_mode: 'manual', display_status: 'Expired',
    },
  });

  // Trials
  const trialStart = new Date(); trialStart.setDate(trialStart.getDate() - 1);
  const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 2);

  await prisma.trials.upsert({
    where: { trial_id: 'trial-001' },
    update: {},
    create: {
      trial_id: 'trial-001', plan_id: plan1.plan_id, user_id: user3.user_id,
      venue_id: passVenue.venue_id, sport: 'yoga',
      start_date: trialStart, end_date: trialEnd, status: 'active',
    },
  });

  // Staff
  await prisma.staff_coaches.upsert({
    where: { staff_id: 'staff-001' },
    update: {},
    create: {
      staff_id: 'staff-001', vendor_id: passVendor.vendor_id, venue_id: passVenue.venue_id,
      name: 'Neha Kapoor', role: 'coach', commission_rate: 20,
      assigned_classes: ['yoga', 'zumba'],
    },
  });

  // MRR Snapshots
  const mrrMonths = [
    { date: new Date('2025-01-31'), mrr: 18000, members: 6 },
    { date: new Date('2025-02-28'), mrr: 21000, members: 7 },
    { date: new Date('2025-03-31'), mrr: 24000, members: 8 },
  ];
  for (const [i, m] of mrrMonths.entries()) {
    await prisma.mrr_snapshots.upsert({
      where: { snapshot_id: `mrr-00${i + 1}` },
      update: {},
      create: {
        snapshot_id: `mrr-00${i + 1}`, vendor_id: passVendor.vendor_id,
        venue_id: passVenue.venue_id, date: m.date,
        mrr_amount: m.mrr, active_members_count: m.members,
      },
    });
  }

  console.log('✅ Seed complete!');
  console.log('  Play-track vendor: vendor-play-001 (SportZone Courts)');
  console.log('  Pass-track vendor: vendor-pass-001 (FitLife Studio)');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
