const fs = require('fs');
const glob = require('glob');

const replacements = {
  "from '@mastra/core'": "from '@mastra/core/tools'",
};

glob.sync('src/tools/**/*.ts').forEach(file => {
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(/from '@mastra\/core'/g, "from '@mastra/core/tools'");
  fs.writeFileSync(file, c);
  console.log('Updated ' + file);
});

const agentFile = 'src/agents/copilotAgent.ts';
let agentC = fs.readFileSync(agentFile, 'utf8');
agentC = agentC.replace(/from '@mastra\/core'/g, "from '@mastra/core/agent'");
fs.writeFileSync(agentFile, agentC);
console.log('Updated ' + agentFile);

const workflowFile = 'src/workflows/auditWorkflow.ts';
let workflowC = fs.readFileSync(workflowFile, 'utf8');
workflowC = workflowC.replace(/from '@mastra\/core'/g, "from '@mastra/core/workflows'");
fs.writeFileSync(workflowFile, workflowC);
console.log('Updated ' + workflowFile);

const indexFile = 'src/index.ts';
let indexC = fs.readFileSync(indexFile, 'utf8');
indexC = indexC.replace(/import { createAgent } from '@mastra\/core'/g, "import { Agent } from '@mastra/core/agent'");
// Wait, index might just not need createAgent if it just exports the agent.
fs.writeFileSync(indexFile, indexC);
console.log('Updated ' + indexFile);
