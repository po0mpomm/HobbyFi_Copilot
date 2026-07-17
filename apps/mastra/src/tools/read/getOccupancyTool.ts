import type { SessionContext } from '../../types/session';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { prisma } from 'db';

export const makeGetOccupancyTool = (session: SessionContext) => createTool({
  id: 'get_occupancy',
  description: 'Get slot occupancy rates for courts/slots at a venue. Returns booked vs total slots.',
  inputSchema: z.object({
    venue_id: z.string().describe('Venue UUID to check occupancy for'),
    from_date: z.string().optional(),
    to_date: z.string().optional(),
  }),
  execute: async (context) => {
    const { vendor_id, staff_user_id } = session;
    const { venue_id, from_date, to_date } = context;

    const venue = await prisma.venues.findFirst({ where: { venue_id, vendor_id } });
    if (!venue) return { error: 'Venue not found or does not belong to this vendor' };

    const slots = await prisma.courts_or_slots.findMany({
      where: { venue_id },
      select: { slot_id: true, sport: true, capacity: true, price_per_hour: true, is_active: true },
    });

    const where: Record<string, unknown> = { venue_id };
    if (from_date || to_date) {
      where.booking_date = {};
      if (from_date) (where.booking_date as Record<string, Date>).gte = new Date(from_date);
      if (to_date) (where.booking_date as Record<string, Date>).lte = new Date(to_date);
    }

    const bookings = await prisma.bookings.findMany({
      where: { ...where, status: { in: ['confirmed', 'completed'] } },
      select: { slot_id: true },
    });

    const bookedMap: Record<string, number> = {};
    for (const b of bookings) {
      bookedMap[b.slot_id] = (bookedMap[b.slot_id] || 0) + 1;
    }

    const occupancyData = slots.map(slot => ({
      slot_id: slot.slot_id,
      sport: slot.sport,
      capacity: slot.capacity,
      is_active: slot.is_active,
      booked_count: bookedMap[slot.slot_id] || 0,
      occupancy_rate: slot.capacity > 0
        ? Math.round(((bookedMap[slot.slot_id] || 0) / slot.capacity) * 100)
        : 0,
    }));

    const avgOccupancy = occupancyData.length > 0
      ? Math.round(occupancyData.reduce((s, d) => s + d.occupancy_rate, 0) / occupancyData.length)
      : 0;

    return { venue_name: venue.name, slots: occupancyData, avg_occupancy_rate: avgOccupancy };
  },
});
