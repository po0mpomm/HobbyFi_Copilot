import { createTool } from '@mastra/core';
import { z } from 'zod';
import { prisma } from 'db';

export const listMembershipsTool = createTool({
  id: 'list_memberships',
  description: 'List memberships for the vendor, filterable by status and plan.',
  inputSchema: z.object({
    vendor_id: z.string(),
    venue_id: z.string().optional(),
    status: z.enum(['active', 'expired', 'cancelled']).optional(),
    limit: z.number().default(20),
  }),
  execute: async ({ context }) => {
    const { vendor_id, venue_id, status, limit } = context;

    const vendorVenues = await prisma.venues.findMany({ where: { vendor_id }, select: { venue_id: true } });
    const vendorVenueIds = vendorVenues.map(v => v.venue_id);

    if (venue_id && !vendorVenueIds.includes(venue_id)) {
      return { error: 'Venue not found or does not belong to this vendor' };
    }

    const scopedVenueIds = venue_id ? [venue_id] : vendorVenueIds;

    const where: Record<string, unknown> = { venue_id: { in: scopedVenueIds } };
    if (status) where.status = status;

    const memberships = await prisma.memberships.findMany({
      where,
      take: limit,
      orderBy: { start_date: 'desc' },
      select: {
        membership_id: true,
        status: true,
        display_status: true,
        is_trial: true,
        start_date: true,
        end_date: true,
        payment_mode: true,
        user: { select: { name: true, phone: true } },
        plan: { select: { plan_name: true, sport: true, price: true } },
        venue: { select: { name: true } },
      },
    });

    return {
      memberships,
      total: memberships.length,
      active_count: memberships.filter(m => m.status === 'active').length,
      expired_count: memberships.filter(m => m.status === 'expired').length,
    };
  },
});
