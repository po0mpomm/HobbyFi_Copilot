import type { SessionContext } from '../../types/session';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { prisma } from 'db';

export const makeListBookingsTool = (session: SessionContext) => createTool({
  id: 'list_bookings',
  description: 'List bookings for a vendor, filterable by venue, status, and date range.',
  inputSchema: z.object({
    venue_id: z.string().optional(),
    status: z.enum(['confirmed', 'cancelled', 'completed', 'no_show']).optional(),
    from_date: z.string().optional().describe('ISO date string'),
    to_date: z.string().optional().describe('ISO date string'),
    limit: z.number().default(20),
  }),
  execute: async (context) => {
    const { vendor_id, staff_user_id } = session;
    const { venue_id, status, from_date, to_date, limit } = context;

    // First get all venue_ids for this vendor to scope safely
    const vendorVenues = await prisma.venues.findMany({ where: { vendor_id }, select: { venue_id: true } });
    const vendorVenueIds = vendorVenues.map(v => v.venue_id);

    if (venue_id && !vendorVenueIds.includes(venue_id)) {
      return { error: 'Venue not found or does not belong to this vendor' };
    }

    const scopedVenueIds = venue_id ? [venue_id] : vendorVenueIds;

    const where: Record<string, unknown> = { venue_id: { in: scopedVenueIds } };
    if (status) where.status = status;
    if (from_date || to_date) {
      where.booking_date = {};
      if (from_date) (where.booking_date as Record<string, Date>).gte = new Date(from_date);
      if (to_date) (where.booking_date as Record<string, Date>).lte = new Date(to_date);
    }

    const bookings = await prisma.bookings.findMany({
      where,
      take: limit,
      orderBy: { created_at: 'desc' },
      select: {
        booking_id: true,
        sport: true,
        booking_date: true,
        start_time: true,
        end_time: true,
        status: true,
        total_amount: true,
        split_type: true,
        venue: { select: { name: true } },
        user: { select: { name: true } },
      },
    });

    return { bookings, total: bookings.length };
  },
});
