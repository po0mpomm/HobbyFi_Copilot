/**
 * Guardrails: Input and Output processors for the Copilot agent.
 * 
 * These implement the 3-layer guardrail strategy from the TRD:
 *  Layer 1 (Input): Prompt injection detection, vendor scope validation
 *  Layer 2 (Tool): Tool registry filtering by track (done via toolRegistry.ts)
 *  Layer 3 (Output): KYC field scrubbing, bulk PII dump detection
 */

// KYC fields that must NEVER appear in any Copilot response
const KYC_FIELD_PATTERNS = [
  /pan_number/gi,
  /bank_account/gi,
  /gst_number/gi,
  /\bPAN\b/g,
  /\bIFSC\b/g,
];

// Patterns that indicate prompt injection attempts
const PROMPT_INJECTION_PATTERNS = [
  /ignore (previous|all|above) instructions/gi,
  /you are now/gi,
  /act as/gi,
  /jailbreak/gi,
  /system prompt/gi,
  /\[INST\]/gi,
  /<\|im_start\|>/gi,
];

// Patterns suggesting a bulk PII dump request
const BULK_PII_PATTERNS = [
  /all (user|member|customer) (phone|email|contact)/gi,
  /export (all|every) (user|member)/gi,
  /dump (all|the) (database|data)/gi,
  /list every (user|member|customer)/gi,
];

export function detectPromptInjection(input: string): { safe: boolean; reason?: string } {
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return {
        safe: false,
        reason: `Potential prompt injection detected. Pattern: ${pattern.source}`,
      };
    }
  }
  return { safe: true };
}

export function detectBulkPIIRequest(input: string): { safe: boolean; reason?: string } {
  for (const pattern of BULK_PII_PATTERNS) {
    if (pattern.test(input)) {
      return {
        safe: false,
        reason: 'Bulk PII export requests are not supported for compliance reasons.',
      };
    }
  }
  return { safe: true };
}

export function scrubKYCFields(output: string): string {
  let scrubbed = output;
  for (const pattern of KYC_FIELD_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, '[REDACTED]');
  }
  return scrubbed;
}

export function scrubKYCFromObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return scrubKYCFields(obj);
  if (Array.isArray(obj)) return obj.map(scrubKYCFromObject);
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Drop KYC fields at the object level too
      if (['pan_number', 'bank_account', 'gst_number'].includes(key)) continue;
      result[key] = scrubKYCFromObject(value);
    }
    return result;
  }
  return obj;
}

/**
 * Main input processor — run this before passing a message to the agent.
 * Returns { blocked: true, reason } if the message should be blocked.
 */
export function processInput(message: string): { blocked: boolean; reason?: string } {
  const injectionCheck = detectPromptInjection(message);
  if (!injectionCheck.safe) return { blocked: true, reason: injectionCheck.reason };

  const bulkPIICheck = detectBulkPIIRequest(message);
  if (!bulkPIICheck.safe) return { blocked: true, reason: bulkPIICheck.reason };

  return { blocked: false };
}

/**
 * Main output processor — run this on the agent's response before returning to client.
 */
export function processOutput(text: string): string {
  return scrubKYCFields(text);
}
