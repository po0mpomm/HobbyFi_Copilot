import { NextResponse } from 'next/server';
import { prisma } from 'db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const vendorId = searchParams.get('vendorId');
  const track = searchParams.get('track');

  if (!vendorId || !track) {
    return NextResponse.json({ error: 'Missing vendorId or track' }, { status: 400 });
  }

  try {
    // 1. Revenue this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const revenueResult = await prisma.transactions.aggregate({
      _sum: { amount: true },
      where: {
        vendor_id: vendorId,
        status: 'success',
        created_at: { gte: startOfMonth }
      }
    });
    const revenue = revenueResult._sum.amount || 0;

    // 2. Pending Payouts
    const payoutsResult = await prisma.payouts.aggregate({
      _sum: { net_amount: true },
      where: {
        vendor_id: vendorId,
        status: 'pending'
      }
    });
    const pendingPayout = payoutsResult._sum.net_amount || 0;

    // 3. Track-specific metric
    let activityCount = 0;
    if (track === 'play') {
      const bookingsCount = await prisma.bookings.count({
        where: { venue: { vendor_id: vendorId } }
      });
      activityCount = bookingsCount;
    } else {
      const activeMembers = await prisma.memberships.count({
        where: {
          venue: { vendor_id: vendorId },
          status: 'active'
        }
      });
      activityCount = activeMembers;
    }

    return NextResponse.json({ revenue, pendingPayout, activityCount });

  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
