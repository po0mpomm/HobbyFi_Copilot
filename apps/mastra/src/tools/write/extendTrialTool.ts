import type { SessionContext } from '../../types/session';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { prisma } from 'db';
import { createAuditEntry } from '../../audit/auditService';

export const makeExtendTrialTool = (session: SessionContext) => createTool({
  id: 'Extend Trial',
  description: 'Extends a trial for a user by a specified number of days. Writes a pending approval entry to the audit log.',
  inputSchema: z.object({
    trial_id: z.string().describe('The UUID of the trial to extend'),
    days: z.number().describe('Number of days to extend'),
    reason: z.string().describe('Reason for extension'),
  }),
  execute: async (context) => {
    const { vendor_id } = session;
    const { trial_id, days, reason } = context;

    const trial = await prisma.trials.findFirst({
      where: { trial_id, venue: { vendor_id } },
      include: { user: { select: { name: true } } },
    });

    if (!trial) return { error: 'Trial not found or does not belong to this vendor' };

    const diff = {
      action_type: 'extend_trial',
      target_entity_type: 'trials',
      target_entity_id: trial_id,
      current_value: { end_date: trial.end_date },
      proposed_value: { days_to_add: days },
      downstream_effects: [`Reason: ${reason}`],
    };

    const log = await createAuditEntry(diff, session, session.request_text, session.thread_id ?? 'no-thread');

    return {
      status: 'pending_approval',
      log_id: log.log_id,
      message: `Trial extension for "${trial.user?.name ?? trial_id}" (${days} days) has been submitted for approval. Log ID: ${log.log_id}`,
    };
  },
});
