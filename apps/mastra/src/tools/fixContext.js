const fs = require('fs');
const path = require('path');

const readDir = 'c:/Users/anvay/Desktop/HobbyFi_Copilot/apps/mastra/src/tools/read';
const writeDir = 'c:/Users/anvay/Desktop/HobbyFi_Copilot/apps/mastra/src/tools/write';

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Change execute: async ({ context }) => { to execute: async (context) => {
  content = content.replace(/execute:\s*async\s*\(\{\s*context\s*\}\)\s*=>\s*\{/g, 'execute: async (context) => {');
  
  // Handle case with runId: execute: async ({ context, runId }) => {
  content = content.replace(/execute:\s*async\s*\(\{\s*context,\s*runId\s*\}\)\s*=>\s*\{/g, 'execute: async (context) => {');
  
  // Also we need to replace any usages of runId with 'unknown' or just a dummy string since it's not provided by tool args anymore
  content = content.replace(/conversation_id:\s*runId\s*\|\|\s*'unknown'/g, "conversation_id: 'unknown'");

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed', filePath);
}

[readDir, writeDir].forEach(dir => {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));
  files.forEach(f => processFile(path.join(dir, f)));
});
