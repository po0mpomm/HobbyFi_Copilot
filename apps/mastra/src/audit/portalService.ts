/**
 * Stub portal services for execution of approved actions.
 * In production, these would call real booking/membership microservices.
 */
import { prisma } from 'db';
import type { ProposedDiff } from '../types/session';

export async function executeApprovedDiff(diff: ProposedDiff, log_id: string): Promise<{ success: boolean; detail?: string }> {
  const { action_type, target_entity_id, proposed_value } = diff;

  try {
    switch (action_type) {
      case 'extend_trial': {
        const { days_to_add } = proposed_value as { days_to_add: number };
        const trial = await prisma.trials.findUnique({ where: { trial_id: target_entity_id } });
        if (!trial) return { success: false, detail: 'Trial not found' };

        const newEndDate = new Date(trial.end_date);
        newEndDate.setDate(newEndDate.getDate() + days_to_add);
        await prisma.trials.update({
          where: { trial_id: target_entity_id },
          data: { end_date: newEndDate },
        });
        return { success: true, detail: `Trial extended to ${newEndDate.toISOString().split('T')[0]}` };
      }

      case 'mark_no_show': {
        await prisma.bookings.update({
          where: { booking_id: target_entity_id },
          data: { status: 'no_show' },
        });
        return { success: true, detail: 'Booking marked as no-show' };
      }

      case 'cancel_booking': {
        await prisma.bookings.update({
          where: { booking_id: target_entity_id },
          data: { status: 'cancelled' },
        });
        return { success: true, detail: 'Booking cancelled' };
      }

      case 'update_membership_end_date': {
        const { end_date } = proposed_value as { end_date: string };
        await prisma.memberships.update({
          where: { membership_id: target_entity_id },
          data: { end_date: new Date(end_date) },
        });
        return { success: true, detail: `Membership end date updated to ${end_date}` };
      }

      default:
        return { success: false, detail: `Unknown action type: ${action_type}` };
    }
  } catch (err) {
    return { success: false, detail: String(err) };
  }
}
