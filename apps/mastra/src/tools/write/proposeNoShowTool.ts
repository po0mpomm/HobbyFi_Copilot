import { createTool } from '@mastra/core';
import { z } from 'zod';
import { prisma } from 'db';

export const proposeNoShowTool = createTool({
  id: 'propose_no_show',
  description: 'Mark a booking as no-show. Requires vendor approval before execution.',
  inputSchema: z.object({
    vendor_id: z.string(),
    booking_id: z.string(),
  }),
  execute: async ({ context }) => {
    const { vendor_id, booking_id } = context;

    // Validate booking belongs to vendor
    const vendorVenues = await prisma.venues.findMany({ where: { vendor_id }, select: { venue_id: true } });
    const vendorVenueIds = vendorVenues.map(v => v.venue_id);

    const booking = await prisma.bookings.findFirst({
      where: { booking_id, venue_id: { in: vendorVenueIds } },
      include: { user: { select: { name: true } }, venue: { select: { name: true } } },
    });

    if (!booking) return { error: 'Booking not found or does not belong to this vendor' };
    if (booking.status !== 'confirmed') {
      return { error: `Cannot mark as no-show: booking is already "${booking.status}"` };
    }

    // Return proposed diff — do NOT write to DB yet
    return {
      status: 'pending_approval',
      proposed_diff: {
        action_type: 'mark_no_show',
        target_entity_type: 'bookings',
        target_entity_id: booking_id,
        current_value: { status: booking.status },
        proposed_value: { status: 'no_show' },
        downstream_effects: ['Payment may need to be assessed per your cancellation policy'],
      },
      message: `Ready to mark booking for "${booking.user.name}" at ${booking.venue.name} as no-show. Please approve or reject in the dashboard.`,
    };
  },
});
