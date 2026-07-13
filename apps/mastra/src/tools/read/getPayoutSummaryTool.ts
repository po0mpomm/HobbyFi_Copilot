import { createTool } from '@mastra/core';
import { z } from 'zod';
import { prisma } from 'db';

export const getPayoutSummaryTool = createTool({
  id: 'get_payout_summary',
  description: 'Get payout summary for a vendor, optionally by venue and period.',
  inputSchema: z.object({
    vendor_id: z.string(),
    venue_id: z.string().optional(),
    from_date: z.string().optional(),
    to_date: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { vendor_id, venue_id, from_date, to_date } = context;

    if (venue_id) {
      const venue = await prisma.venues.findFirst({ where: { venue_id, vendor_id } });
      if (!venue) return { error: 'Venue not found or does not belong to this vendor' };
    }

    const where: Record<string, unknown> = { vendor_id };
    if (venue_id) where.venue_id = venue_id;
    if (from_date || to_date) {
      where.period_start = {};
      if (from_date) (where.period_start as Record<string, Date>).gte = new Date(from_date);
      if (to_date) (where.period_start as Record<string, Date>).lte = new Date(to_date);
    }

    const payouts = await prisma.payouts.findMany({ where });

    const summary = {
      total_gross: payouts.reduce((s, p) => s + p.gross_amount, 0),
      total_commission: payouts.reduce((s, p) => s + p.commission_deducted, 0),
      total_net: payouts.reduce((s, p) => s + p.net_amount, 0),
      settled_count: payouts.filter(p => p.status === 'settled').length,
      pending_count: payouts.filter(p => p.status === 'pending').length,
      payouts: payouts.map(p => ({
        payout_id: p.payout_id,
        period_start: p.period_start,
        period_end: p.period_end,
        gross_amount: p.gross_amount,
        net_amount: p.net_amount,
        status: p.status,
        settled_at: p.settled_at,
      })),
    };

    return summary;
  },
});
