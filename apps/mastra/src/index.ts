import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from '@ai-sdk/google';
import { createAgent } from '@mastra/core';
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

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.PORTAL_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());

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

  // Layer 1: Input guardrails
  const inputCheck = processInput(message);
  if (inputCheck.blocked) {
    return res.status(400).json({ error: inputCheck.reason });
  }

  // Build the system prompt with vendor context injected server-side
  const systemPrompt = `You are the HobbyFi Copilot, an AI assistant for sports and fitness vendors.

VENDOR CONTEXT (DO NOT SHARE WITH USER):
- Vendor ID: ${session.vendor_id}
- Active Tracks: ${session.active_tracks.join(', ')}
- Venue IDs: ${session.venue_ids.join(', ')}

CRITICAL RULES:
1. You MUST always pass vendor_id="${session.vendor_id}" when calling any tool. Never use a different vendor_id.
2. NEVER expose PAN numbers, bank account details, GST numbers, or any KYC data.
3. For write operations, use the appropriate propose_* tool. The action will be submitted for vendor approval. Tell the user it's pending approval.
4. If asked for data outside your active tracks (${session.active_tracks.join(', ')}), politely decline.
5. Be concise, professional, and helpful.
6. When showing tables, use markdown format.

AVAILABLE TRACKS: ${session.active_tracks.join(', ')}`;

  // Get track-appropriate tools
  const tools = getToolsForSession(session);

  try {
    // Create a dynamic agent with session-scoped tools
    const agent = createAgent({
      name: 'HobbyFi Copilot',
      instructions: systemPrompt,
      model: google('gemini-2.0-flash'),
      tools: tools as Record<string, unknown>,
    });

    const result = await agent.generate(message, { threadId: thread_id });

    // Layer 3: Output guardrails
    const safeText = processOutput(result.text);

    res.json({
      text: safeText,
      thread_id: thread_id || result.threadId,
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Failed to process chat message' });
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
  const { log_id } = req.params;
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
  const { log_id } = req.params;
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
