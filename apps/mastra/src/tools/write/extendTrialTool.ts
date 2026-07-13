import { createTool } from '@mastra/core';
import { z } from 'zod';
import { auditWorkflow } from '../../workflows/auditWorkflow';

export const extendTrialTool = createTool({
  id: 'Extend Trial',
  description: 'Extends a trial for a user by a specified number of days.',
  inputSchema: z.object({
    trial_id: z.string().describe('The UUID of the trial to extend'),
    days: z.number().describe('Number of days to extend'),
    reason: z.string().describe('Reason for extension'),
  }),
  execute: async ({ context, runId }) => {
    // In Mastra, tools can trigger workflows.
    // We don't execute the DB write directly. We trigger the audit workflow.
    
    // We assume the agent has vendor_id, user_id, conversation_id in its execution context
    // For now we will mock these or pass them from tool arguments if needed, 
    // but typically they are injected via the Mastra engine context or thread state.
    
    // In a real implementation, we'd extract these from the global context
    const vendor_id = 'mock-vendor-id'; // To be replaced with context injection
    const staff_user_id = 'mock-staff-id';
    
    try {
      const { runId: workflowRunId } = await auditWorkflow.execute({
        triggerData: {
          vendor_id,
          staff_user_id,
          conversation_id: runId || 'unknown',
          request_text: `Extend trial ${context.trial_id} by ${context.days} days. Reason: ${context.reason}`,
          resolved_action_type: 'extend_trial',
          target_entity_type: 'trials',
          target_entity_id: context.trial_id,
          proposed_diff: { days_to_add: context.days },
        }
      });
      
      // We suspend the workflow so it waits for approval
      await auditWorkflow.suspend({ runId: workflowRunId, stepId: 'executeAction' });
      
      return { 
        status: 'pending_approval', 
        message: 'The trial extension request has been proposed and is awaiting your approval in the dashboard.',
        workflow_run_id: workflowRunId
      };
    } catch (e) {
        return { error: 'Failed to propose action' };
    }
  },
});
