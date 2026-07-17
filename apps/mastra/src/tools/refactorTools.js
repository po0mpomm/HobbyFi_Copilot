const fs = require('fs');
const path = require('path');

const readDir = 'c:/Users/anvay/Desktop/HobbyFi_Copilot/apps/mastra/src/tools/read';
const writeDir = 'c:/Users/anvay/Desktop/HobbyFi_Copilot/apps/mastra/src/tools/write';

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add import
  if (!content.includes('SessionContext')) {
    content = "import type { SessionContext } from '../../types/session';\n" + content;
  }

  // 2. Change export const xyzTool = createTool({ -> export const makeXyzTool = (session: SessionContext) => createTool({
  const exportMatch = content.match(/export const (\w+) = createTool\(\{/);
  if (exportMatch) {
    const toolName = exportMatch[1];
    const newToolName = 'make' + capitalize(toolName);
    content = content.replace(exportMatch[0], `export const ${newToolName} = (session: SessionContext) => createTool({`);
  }

  // 3. Remove vendor_id from Zod schema
  // regex to match `vendor_id: z.string()... ,` (possibly multi-line)
  content = content.replace(/vendor_id:\s*z\.string\(\)[^,]+,\n?/g, '');

  // 4. In execute: async ({ context... }) => {
  // We need to inject const { vendor_id, staff_user_id } = session;
  // Also remove vendor_id from context destructuring if it exists.
  
  content = content.replace(/const \{([^}]+)\} = context;/g, (match, vars) => {
    const parts = vars.split(',').map(s => s.trim()).filter(s => s !== 'vendor_id');
    if (parts.length > 0) {
      return `const { ${parts.join(', ')} } = context;`;
    }
    return '';
  });

  // Inject session vars right after execute: async... {
  content = content.replace(/execute:\s*async\s*\(\{\s*context(.*)\}\)\s*=>\s*\{/g, (match) => {
    return match + `\n    const { vendor_id, staff_user_id } = session;`;
  });

  // 5. Remove mock declarations
  content = content.replace(/const vendor_id = 'mock-vendor-id';.*\n/g, '');
  content = content.replace(/const staff_user_id = 'mock-staff-id';.*\n/g, '');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Processed', filePath);
}

[readDir, writeDir].forEach(dir => {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));
  files.forEach(f => processFile(path.join(dir, f)));
});
