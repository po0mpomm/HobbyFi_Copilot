import type { SessionContext } from '../../types/session';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { prisma } from 'db';
import { createAuditEntry } from '../../audit/auditService';

export const makeProposeNoShowTool = (session: SessionContext) => createTool({
  id: 'propose_no_show',
  description: 'Mark a booking as no-show. Writes a pending approval entry to the audit log.',
  inputSchema: z.object({
    booking_id: z.string(),
  }),
  execute: async (context) => {
    const { vendor_id } = session;
    const { booking_id } = context;

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

    const diff = {
      action_type: 'mark_no_show',
      target_entity_type: 'bookings',
      target_entity_id: booking_id,
      current_value: { status: booking.status },
      proposed_value: { status: 'no_show' },
      downstream_effects: ['Payment may need to be assessed per your cancellation policy'],
    };

    const log = await createAuditEntry(diff, session, session.request_text, session.thread_id ?? 'no-thread');

    return {
      status: 'pending_approval',
      log_id: log.log_id,
      message: `No-show for "${booking.user.name}" at ${booking.venue.name} has been submitted for approval. Log ID: ${log.log_id}`,
    };
  },
});
