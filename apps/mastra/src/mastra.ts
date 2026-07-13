import { Mastra } from '@mastra/core';
import { Memory } from '@mastra/memory';
import { copilotAgent } from './agents/copilotAgent';
import { auditWorkflow } from './workflows/auditWorkflow';

export const mastra = new Mastra({
  agents: { copilotAgent },
  workflows: { auditWorkflow },
  memory: new Memory(),
});
