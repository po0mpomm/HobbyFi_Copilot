import type { SessionContext } from '../../types/session';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { prisma } from 'db';
import { createAuditEntry } from '../../audit/auditService';

export const makeProposeMembershipUpdateTool = (session: SessionContext) => createTool({
  id: 'propose_membership_update',
  description: 'Update a membership end date. Writes a pending approval entry to the audit log.',
  inputSchema: z.object({
    membership_id: z.string(),
    new_end_date: z.string().describe('New end date in ISO format, e.g. 2025-12-31'),
  }),
  execute: async (context) => {
    const { vendor_id } = session;
    const { membership_id, new_end_date } = context;

    const vendorVenues = await prisma.venues.findMany({ where: { vendor_id }, select: { venue_id: true } });
    const vendorVenueIds = vendorVenues.map(v => v.venue_id);

    const membership = await prisma.memberships.findFirst({
      where: { membership_id, venue_id: { in: vendorVenueIds } },
      include: {
        user: { select: { name: true } },
        plan: { select: { plan_name: true } },
        venue: { select: { name: true } },
      },
    });

    if (!membership) return { error: 'Membership not found or does not belong to this vendor' };

    const parsedDate = new Date(new_end_date);
    if (isNaN(parsedDate.getTime())) return { error: 'Invalid date format. Use ISO format, e.g. 2025-12-31' };

    const diff = {
      action_type: 'update_membership_end_date',
      target_entity_type: 'memberships',
      target_entity_id: membership_id,
      current_value: { end_date: membership.end_date },
      proposed_value: { end_date: parsedDate },
      downstream_effects: [
        `Membership for "${membership.user.name}" (${membership.plan.plan_name}) will be extended to ${new_end_date}`,
      ],
    };

    const log = await createAuditEntry(diff, session, session.request_text, session.thread_id ?? 'no-thread');

    return {
      status: 'pending_approval',
      log_id: log.log_id,
      message: `Membership update for "${membership.user.name}" at ${membership.venue.name} to end on ${new_end_date} has been submitted for approval. Log ID: ${log.log_id}`,
    };
  },
});
