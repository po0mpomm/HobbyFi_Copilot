import { createTool } from '@mastra/core';
import { z } from 'zod';
import { prisma } from 'db';

export const getMrrSnapshotTool = createTool({
  id: 'get_mrr_snapshot',
  description: 'Get Monthly Recurring Revenue (MRR) snapshot and active member count for the vendor.',
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
      where.date = {};
      if (from_date) (where.date as Record<string, Date>).gte = new Date(from_date);
      if (to_date) (where.date as Record<string, Date>).lte = new Date(to_date);
    }

    const snapshots = await prisma.mrr_snapshots.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 12,
    });

    const latestSnapshot = snapshots[0];
    const trend = snapshots.length > 1
      ? ((latestSnapshot.mrr_amount - snapshots[snapshots.length - 1].mrr_amount) / snapshots[snapshots.length - 1].mrr_amount) * 100
      : 0;

    return {
      current_mrr: latestSnapshot?.mrr_amount ?? 0,
      current_active_members: latestSnapshot?.active_members_count ?? 0,
      mrr_trend_percent: Math.round(trend * 100) / 100,
      history: snapshots.map(s => ({
        date: s.date,
        mrr: s.mrr_amount,
        active_members: s.active_members_count,
      })),
    };
  },
});
