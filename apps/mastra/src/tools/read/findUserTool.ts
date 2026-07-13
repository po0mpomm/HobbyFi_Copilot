import { createTool } from '@mastra/core';
import { z } from 'zod';
import { prisma } from 'db';

export const findUserTool = createTool({
  id: 'find_user',
  description:
    'Find a user by name or phone across the vendor\'s venues. Returns minimal PII: name, phone, and last venue interaction only. Does NOT expose email or full booking history.',
  inputSchema: z.object({
    vendor_id: z.string(),
    search: z.string().describe('Partial name or phone number to search'),
    limit: z.number().default(5),
  }),
  execute: async ({ context }) => {
    const { vendor_id, search, limit } = context;

    // Get all venue_ids for this vendor to scope the search
    const vendorVenues = await prisma.venues.findMany({ where: { vendor_id }, select: { venue_id: true, name: true } });
    const vendorVenueIds = vendorVenues.map(v => v.venue_id);

    // Find users who have had interactions (bookings or memberships) at vendor's venues
    const bookingUserIds = await prisma.bookings.findMany({
      where: { venue_id: { in: vendorVenueIds } },
      select: { booked_by_user_id: true, venue_id: true, booking_date: true },
      distinct: ['booked_by_user_id'],
    });

    const membershipUserIds = await prisma.memberships.findMany({
      where: { venue_id: { in: vendorVenueIds } },
      select: { user_id: true, venue_id: true, start_date: true },
      distinct: ['user_id'],
    });

    const allUserIds = [
      ...new Set([
        ...bookingUserIds.map(b => b.booked_by_user_id),
        ...membershipUserIds.map(m => m.user_id),
      ]),
    ];

    // Search among those users only (vendor-scoped)
    const users = await prisma.users.findMany({
      where: {
        user_id: { in: allUserIds },
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      },
      take: limit,
      select: {
        user_id: true,
        name: true,
        phone: true,
        // NOTE: email is intentionally omitted from copilot results
      },
    });

    return { users, total: users.length };
  },
});
