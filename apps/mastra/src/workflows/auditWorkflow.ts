import { Workflow, Step } from '@mastra/core';
import { z } from 'zod';
import { prisma } from 'db';

// Step 1: Submit the audit log request
const submitAuditStep = new Step({
  id: 'submitAuditLog',
  description: 'Creates a proposed audit log entry for the intended action.',
  inputSchema: z.object({
    vendor_id: z.string(),
    staff_user_id: z.string(),
    conversation_id: z.string(),
    request_text: z.string(),
    resolved_action_type: z.string(),
    target_entity_type: z.string(),
    target_entity_id: z.string(),
    proposed_diff: z.any(),
  }),
  outputSchema: z.object({
    log_id: z.string(),
  }),
  execute: async ({ context }) => {
    // In Mastra workflows, context might contain triggerData or previous step outputs
    const payload = context?.triggerData; 
    
    if (!payload || !payload.vendor_id) {
        throw new Error("Missing payload for audit submission");
    }

    const log = await prisma.copilot_audit_log.create({
      data: {
        vendor_id: payload.vendor_id,
        staff_user_id: payload.staff_user_id,
        conversation_id: payload.conversation_id,
        request_text: payload.request_text,
        resolved_action_type: payload.resolved_action_type,
        target_entity_type: payload.target_entity_type,
        target_entity_id: payload.target_entity_id,
        proposed_diff: payload.proposed_diff,
        status: 'proposed',
      }
    });
    
    return { log_id: log.log_id };
  }
});

// Step 2: Execute the approved action
const executeActionStep = new Step({
  id: 'executeAction',
  description: 'Executes the proposed diff against the database once approved.',
  inputSchema: z.object({
    log_id: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
  }),
  execute: async ({ context }) => {
    const { log_id } = context.stepResults.submitAuditLog || context.triggerData;
    
    const log = await prisma.copilot_audit_log.findUnique({
      where: { log_id }
    });

    if (!log) throw new Error("Log not found");
    if (log.status !== 'approved') throw new Error("Action not approved");

    // Here we would apply the actual diff based on resolved_action_type
    // For now, we simulate execution and mark as executed
    
    await prisma.copilot_audit_log.update({
      where: { log_id },
      data: {
        status: 'executed',
        executed_at: new Date()
      }
    });

    return { success: true };
  }
});

// Build the workflow
export const auditWorkflow = new Workflow({
  name: 'audit-approval-workflow',
  triggerSchema: z.object({
    vendor_id: z.string(),
    staff_user_id: z.string(),
    conversation_id: z.string(),
    request_text: z.string(),
    resolved_action_type: z.string(),
    target_entity_type: z.string(),
    target_entity_id: z.string(),
    proposed_diff: z.any(),
  })
})
  .step(submitAuditStep)
  .then(executeActionStep);

/**
 * Note: Mastra allows pausing a workflow for user input using `.suspend()` and `.resume()`.
 * By default, separating steps like this allows us to intercept.
 * We can suspend before executeActionStep.
 */
auditWorkflow.commit();
