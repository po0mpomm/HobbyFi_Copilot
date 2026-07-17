import type { SessionContext } from '../../types/session';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { prisma } from 'db';
import { createAuditEntry } from '../../audit/auditService';

export const makeProposeCancelBookingTool = (session: SessionContext) => createTool({
  id: 'propose_cancel_booking',
  description: 'Cancel a booking. Writes a pending approval entry to the audit log.',
  inputSchema: z.object({
    booking_id: z.string(),
    reason: z.string().describe('Reason for cancellation'),
  }),
  execute: async (context) => {
    const { vendor_id } = session;
    const { booking_id, reason } = context;

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
    const downstreamEffects = [`Booking "${booking_id}" will be cancelled`, `Reason: ${reason}`];
    if (requiresExtraConfirmation) {
      downstreamEffects.push(`This is a group booking with ${participantCount} participants — all participants will be notified`);
    }

    const diff = {
      action_type: 'cancel_booking',
      target_entity_type: 'bookings',
      target_entity_id: booking_id,
      current_value: { status: booking.status },
      proposed_value: { status: 'cancelled', cancellation_reason: reason },
      downstream_effects: downstreamEffects,
      requires_extra_confirmation: requiresExtraConfirmation,
    };

    const log = await createAuditEntry(diff, session, session.request_text, session.thread_id ?? 'no-thread');

    return {
      status: 'pending_approval',
      log_id: log.log_id,
      message: `Cancellation for booking by "${booking.user.name}" at ${booking.venue.name} has been submitted for approval. ${requiresExtraConfirmation ? '⚠️ This is a group booking.' : ''} Log ID: ${log.log_id}`,
    };
  },
});
