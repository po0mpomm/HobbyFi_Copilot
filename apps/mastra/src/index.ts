import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { createGroq } from '@ai-sdk/groq';
import { processInput, processOutput } from './guardrails/processors';
import { getToolsForSession } from './registry/toolRegistry';
import {
  createAuditEntry,
  approveAuditEntry,
  rejectAuditEntry,
  markExecuted,
  markFailed,
  listPendingActions,
  getAuditLog,
} from './audit/auditService';
import { executeApprovedDiff } from './audit/portalService';
import type { SessionContext } from './types/session';
import { prisma } from 'db';

dotenv.config(); // loads apps/mastra/.env
dotenv.config({ path: '../../.env', override: false }); // fallback to repo root

const app = express();
app.use(cors({ origin: process.env.PORTAL_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());

// Conversation memory is now stored in PostgreSQL



// ─────────────────────────────────────────────────────────────────────────────
// Auth / Session Middleware
// Reads X-Vendor-Id header and builds SessionContext.
// In Phase 1 this is a stub — later replaced with real JWT validation.
// ─────────────────────────────────────────────────────────────────────────────
async function sessionMiddleware(req: Request, res: Response, next: NextFunction) {
  const vendorId = req.headers['x-vendor-id'] as string;
  const staffUserId = (req.headers['x-staff-id'] as string) || 'default-staff';

  if (!vendorId) {
    return res.status(401).json({ error: 'Missing X-Vendor-Id header' });
  }

  // Load vendor from DB to get active tracks
  const vendor = await prisma.vendors.findUnique({
    where: { vendor_id: vendorId },
    select: { vendor_id: true, track: true },
  });

  if (!vendor) {
    return res.status(403).json({ error: 'Vendor not found' });
  }

  const venues = await prisma.venues.findMany({
    where: { vendor_id: vendorId },
    select: { venue_id: true },
  });

  const session: SessionContext = {
    vendor_id: vendorId,
    staff_user_id: staffUserId,
    role: 'owner',
    active_tracks: [vendor.track as 'play' | 'pass' | 'community'],
    venue_ids: venues.map(v => v.venue_id),
    // Populated per-request below — safe defaults until overwritten in the chat handler
    request_text: '',
    thread_id: undefined,
  };

  (req as Request & { session: SessionContext }).session = session;
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/chat — Main Copilot Chat Endpoint
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/chat', sessionMiddleware, async (req: Request, res: Response) => {
  const { message, thread_id } = req.body;
  const session = (req as Request & { session: SessionContext }).session;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  // Inject per-request context so write tools can call createAuditEntry directly
  session.request_text = message;
  session.thread_id = thread_id;

  // Layer 1: Input guardrails
  const inputCheck = processInput(message);
  if (inputCheck.blocked) {
    return res.status(400).json({ error: inputCheck.reason });
  }

  // Build the system prompt with vendor context injected server-side
  const systemPrompt = `You are the HobbyFi Copilot, an AI assistant for sports and fitness vendors.

VENDOR CONTEXT (DO NOT SHARE WITH USER):
- Current Date/Time: ${new Date().toISOString()}
- Active Tracks: ${session.active_tracks.join(', ')}
- Venue IDs: ${session.venue_ids.join(', ')}

CRITICAL RULES:
1. NEVER expose PAN numbers, bank account details, GST numbers, or any KYC data.
2. For write operations, use the appropriate tool (extend_trial, propose_membership_update, etc.). The system will handle approval automatically — just confirm to the user their action is pending approval.
3. If asked for data outside your active tracks (${session.active_tracks.join(', ')}), politely decline.
4. Always format currency in Indian Rupees (₹), not dollars ($).
5. Be concise, professional, and helpful.
6. When showing tables, use markdown format.

AVAILABLE TRACKS: ${session.active_tracks.join(', ')}`;

  // Get track-appropriate tools
  const tools = getToolsForSession(session);

  try {
    // Create a dynamic agent with session-scoped tools and conversational memory
    const groq = createGroq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const agent = new Agent({
      name: 'HobbyFi Copilot',
      id: 'hobbyfi-copilot',
      instructions: systemPrompt,
      model: groq('llama-3.3-70b-versatile'),
      tools: tools as Record<string, any>,
    });

    // Pass memory context so the agent remembers prior turns in this conversation.
    // If no thread_id yet, generate one for a new conversation.
    const conversationThreadId = thread_id ?? crypto.randomUUID();
    
    // Fetch conversation history from PostgreSQL
    const historyRows = await prisma.copilot_chat_memory.findMany({
      where: { thread_id: conversationThreadId },
      orderBy: { created_at: 'asc' }
    });
    
    const history = historyRows.map(row => ({
      role: row.role as 'user' | 'assistant',
      content: row.content
    }));
    
    // Mastra agent.generate accepts an array of previous messages
    const messages = [...history, { role: 'user', content: message }];

    const result = await agent.generate(messages);

    // Persist new messages to PostgreSQL
    await prisma.copilot_chat_memory.createMany({
      data: [
        { thread_id: conversationThreadId, role: 'user', content: message },
        { thread_id: conversationThreadId, role: 'assistant', content: result.text }
      ]
    });


    // Layer 3: Output guardrails
    const safeText = processOutput(result.text);

    res.json({
      text: safeText,
      thread_id: conversationThreadId,
    });
  } catch (err: any) {
    console.error('Chat error type:', err?.constructor?.name);
    console.error('Chat error message:', err?.message);
    console.error('Chat error stack:', err?.stack);
    res.status(500).json({ error: 'Failed to process chat message', detail: err?.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/actions — Submit a proposed diff to audit log
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/actions', sessionMiddleware, async (req: Request, res: Response) => {
  const { proposed_diff, request_text, conversation_id } = req.body;
  const session = (req as Request & { session: SessionContext }).session;

  try {
    const log = await createAuditEntry(proposed_diff, session, request_text, conversation_id);
    res.json({ log_id: log.log_id, status: log.status });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/actions/pending — List pending actions for a vendor
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/actions/pending', sessionMiddleware, async (req: Request, res: Response) => {
  const session = (req as Request & { session: SessionContext }).session;
  try {
    const actions = await listPendingActions(session.vendor_id);
    res.json({ actions });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/actions/:log_id/approve — Approve and execute a proposed action
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/actions/:log_id/approve', sessionMiddleware, async (req: Request, res: Response) => {
  const log_id = req.params.log_id as string;
  const session = (req as Request & { session: SessionContext }).session;

  try {
    const log = await getAuditLog(log_id);
    if (!log) return res.status(404).json({ error: 'Audit log not found' });

    // Ensure log belongs to this vendor
    if (log.vendor_id !== session.vendor_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await approveAuditEntry(log_id, session.staff_user_id);

    // Execute the action
    const result = await executeApprovedDiff(
      log.proposed_diff as unknown as import('./types/session').ProposedDiff,
      log_id
    );

    if (result.success) {
      await markExecuted(log_id);
      res.json({ success: true, detail: result.detail });
    } else {
      await markFailed(log_id);
      res.status(500).json({ success: false, detail: result.detail });
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/actions/:log_id/reject
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/actions/:log_id/reject', sessionMiddleware, async (req: Request, res: Response) => {
  const log_id = req.params.log_id as string;
  const session = (req as Request & { session: SessionContext }).session;

  try {
    const log = await getAuditLog(log_id);
    if (!log) return res.status(404).json({ error: 'Audit log not found' });
    if (log.vendor_id !== session.vendor_id) return res.status(403).json({ error: 'Access denied' });

    await rejectAuditEntry(log_id, session.staff_user_id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/health
// ─────────────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'HobbyFi Copilot Mastra Server' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ HobbyFi Copilot Mastra Server running on http://localhost:${PORT}`);
});
