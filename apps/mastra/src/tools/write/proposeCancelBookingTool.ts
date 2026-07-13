import { createTool } from '@mastra/core';
import { z } from 'zod';
import { prisma } from 'db';

export const proposeCancelBookingTool = createTool({
  id: 'propose_cancel_booking',
  description: 'Cancel a booking. Requires vendor approval. Sets extra confirmation if booking has multiple participants.',
  inputSchema: z.object({
    vendor_id: z.string(),
    booking_id: z.string(),
    reason: z.string().describe('Reason for cancellation'),
  }),
  execute: async ({ context }) => {
    const { vendor_id, booking_id, reason } = context;

    const vendorVenues = await prisma.venues.findMany({ where: { vendor_id }, select: { venue_id: true } });
    const vendorVenueIds = vendorVenues.map(v => v.venue_id);

    const booking = await prisma.bookings.findFirst({
      where: { booking_id, venue_id: { in: vendorVenueIds } },
      include: {
        user: { select: { name: true } },
        venue: { select: { name: true } },
        participants: true,
      },
    });

    if (!booking) return { error: 'Booking not found or does not belong to this vendor' };
    if (booking.status === 'cancelled') return { error: 'Booking is already cancelled' };

    const participantCount = booking.participants.length;
    const requiresExtraConfirmation = participantCount > 1;
    const downstreamEffects = [`Booking "${booking_id}" will be cancelled`];
    if (requiresExtraConfirmation) {
      downstreamEffects.push(`This is a group booking with ${participantCount} participants — all participants will be notified`);
    }

    return {
      status: 'pending_approval',
      requires_extra_confirmation: requiresExtraConfirmation,
      proposed_diff: {
        action_type: 'cancel_booking',
        target_entity_type: 'bookings',
        target_entity_id: booking_id,
        current_value: { status: booking.status },
        proposed_value: { status: 'cancelled', cancellation_reason: reason },
        downstream_effects: downstreamEffects,
        requires_extra_confirmation: requiresExtraConfirmation,
      },
      message: `Ready to cancel booking for "${booking.user.name}" at ${booking.venue.name}. ${requiresExtraConfirmation ? '⚠️ This is a group booking — please confirm carefully.' : 'Please approve or reject in the dashboard.'}`,
    };
  },
});
