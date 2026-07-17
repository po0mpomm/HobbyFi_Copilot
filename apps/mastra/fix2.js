const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir('src/tools', file => {
  if (file.endsWith('.ts')) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/from '@mastra\/core'/g, "from '@mastra/core/tools'");
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
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
fs.writeFileSync(indexFile, indexC);
console.log('Updated ' + indexFile);
