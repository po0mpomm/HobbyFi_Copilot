import { createTool } from '@mastra/core';
import { z } from 'zod';
import { prisma } from 'db';

export const listTrialsTool = createTool({
  id: 'list_trials',
  description: 'List trials for the vendor. Use expiring_within_days to find trials expiring soon.',
  inputSchema: z.object({
    vendor_id: z.string(),
    venue_id: z.string().optional(),
    status: z.enum(['active', 'expired', 'converted', 'no_show']).optional(),
    expiring_within_days: z.number().optional().describe('Show only trials expiring within N days from today'),
    limit: z.number().default(20),
  }),
  execute: async ({ context }) => {
    const { vendor_id, venue_id, status, expiring_within_days, limit } = context;

    const vendorVenues = await prisma.venues.findMany({ where: { vendor_id }, select: { venue_id: true } });
    const vendorVenueIds = vendorVenues.map(v => v.venue_id);

    if (venue_id && !vendorVenueIds.includes(venue_id)) {
      return { error: 'Venue not found or does not belong to this vendor' };
    }

    const scopedVenueIds = venue_id ? [venue_id] : vendorVenueIds;
    const where: Record<string, unknown> = { venue_id: { in: scopedVenueIds } };

    if (status) where.status = status;
    if (expiring_within_days !== undefined) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + expiring_within_days);
      where.status = 'active';
      where.end_date = { lte: cutoff };
    }

    const trials = await prisma.trials.findMany({
      where,
      take: limit,
      orderBy: { end_date: 'asc' },
      select: {
        trial_id: true,
        sport: true,
        start_date: true,
        end_date: true,
        status: true,
        user: { select: { name: true, phone: true } },
        venue: { select: { name: true } },
        plan: { select: { plan_name: true } },
      },
    });

    return { trials, total: trials.length };
  },
});
