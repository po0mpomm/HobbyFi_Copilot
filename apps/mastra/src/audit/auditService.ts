/**
 * Audit service: wraps all copilot_audit_log DB operations.
 * Ensures append-only semantics on proposed_diff.
 */
import { prisma } from 'db';
import type { SessionContext, ProposedDiff } from '../types/session';

export async function createAuditEntry(
  diff: ProposedDiff,
  session: SessionContext,
  request_text: string,
  conversation_id: string
) {
  return prisma.copilot_audit_log.create({
    data: {
      vendor_id: session.vendor_id,
      staff_user_id: session.staff_user_id,
      conversation_id,
      request_text,
      resolved_action_type: diff.action_type,
      target_entity_type: diff.target_entity_type,
      target_entity_id: diff.target_entity_id,
      proposed_diff: diff as unknown as Record<string, unknown>,
      requires_extra_confirmation: diff.requires_extra_confirmation ?? false,
      status: 'proposed',
    },
  });
}

export async function approveAuditEntry(log_id: string, approved_by: string) {
  const log = await prisma.copilot_audit_log.findUnique({ where: { log_id } });
  if (!log) throw new Error('Audit log not found');
  if (log.status !== 'proposed') throw new Error(`Cannot approve: log is already "${log.status}"`);

  return prisma.copilot_audit_log.update({
    where: { log_id },
    data: { status: 'approved', approved_by },
  });
}

export async function rejectAuditEntry(log_id: string, rejected_by: string) {
  const log = await prisma.copilot_audit_log.findUnique({ where: { log_id } });
  if (!log) throw new Error('Audit log not found');
  if (log.status !== 'proposed') throw new Error(`Cannot reject: log is already "${log.status}"`);

  return prisma.copilot_audit_log.update({
    where: { log_id },
    data: { status: 'rejected', approved_by: rejected_by },
  });
}

export async function markExecuted(log_id: string) {
  return prisma.copilot_audit_log.update({
    where: { log_id },
    data: { status: 'executed', executed_at: new Date() },
  });
}

export async function markFailed(log_id: string) {
  return prisma.copilot_audit_log.update({
    where: { log_id },
    data: { status: 'failed' },
  });
}

export async function getAuditLog(log_id: string) {
  return prisma.copilot_audit_log.findUnique({ where: { log_id } });
}

export async function listPendingActions(vendor_id: string) {
  return prisma.copilot_audit_log.findMany({
    where: { vendor_id, status: 'proposed' },
    orderBy: { created_at: 'desc' },
  });
}
