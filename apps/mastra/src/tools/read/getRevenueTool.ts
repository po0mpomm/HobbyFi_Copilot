import type { SessionContext } from '../../types/session';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { prisma } from 'db';

export const makeGetRevenueTool = (session: SessionContext) => createTool({
  id: 'get_revenue',
  description:
    'Get revenue metrics (total transactions, gross amount, commission, net payout) for the vendor, optionally filtered by venue and date range.',
  inputSchema: z.object({
        venue_id: z.string().optional().describe('Optional venue UUID to narrow scope'),
    from_date: z.string().optional().describe('ISO date string, e.g. 2025-01-01'),
    to_date: z.string().optional().describe('ISO date string, e.g. 2025-06-30'),
  }),
  execute: async (context) => {
    const { vendor_id, staff_user_id } = session;
    const { venue_id, from_date, to_date } = context;

    // Validate venue belongs to vendor
    if (venue_id) {
      const venue = await prisma.venues.findFirst({ where: { venue_id, vendor_id } });
      if (!venue) return { error: 'Venue not found or does not belong to this vendor' };
    }

    const where: Record<string, unknown> = { vendor_id };
    if (venue_id) where.venue_id = venue_id;
    if (from_date || to_date) {
      where.created_at = {};
      if (from_date) (where.created_at as Record<string, Date>).gte = new Date(from_date);
      if (to_date) (where.created_at as Record<string, Date>).lte = new Date(to_date);
    }

    const transactions = await prisma.transactions.findMany({ where, select: { amount: true, status: true } });
    
    // For payouts, use the same where clause but map created_at to period_start if dates exist
    const payoutWhere: Record<string, unknown> = { vendor_id, ...(venue_id ? { venue_id } : {}) };
    if (from_date || to_date) {
      payoutWhere.period_start = {};
      if (from_date) (payoutWhere.period_start as Record<string, Date>).gte = new Date(from_date);
      if (to_date) (payoutWhere.period_start as Record<string, Date>).lte = new Date(to_date);
    }
    const payouts = await prisma.payouts.findMany({ where: payoutWhere, select: { gross_amount: true, commission_deducted: true, net_amount: true, status: true } });

    const successfulTx = transactions.filter(t => t.status === 'success');
    const grossRevenue = successfulTx.reduce((s, t) => s + t.amount, 0);
    const settledPayouts = payouts.filter(p => p.status === 'settled');
    const totalCommission = settledPayouts.reduce((s, p) => s + p.commission_deducted, 0);
    const totalNet = settledPayouts.reduce((s, p) => s + p.net_amount, 0);

    return {
      gross_revenue: grossRevenue,
      total_transactions: successfulTx.length,
      commission_deducted: totalCommission,
      net_payout: totalNet,
      pending_payouts: payouts.filter(p => p.status === 'pending').length,
    };
  },
});
