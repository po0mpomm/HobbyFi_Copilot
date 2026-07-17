'use client';
import { useState, useCallback, useRef, useEffect } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface PendingDiff {
  log_id: string;
  action_type: string;
  message: string;
  proposed_diff: {
    action_type: string;
    target_entity_type: string;
    target_entity_id: string;
    current_value: Record<string, unknown>;
    proposed_value: Record<string, unknown>;
    downstream_effects?: string[];
    requires_extra_confirmation?: boolean;
  };
}

const MASTRA_URL = process.env.NEXT_PUBLIC_MASTRA_URL || 'http://localhost:8080';

export function useCopilot(vendorId: string, staffId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingDiffs, setPendingDiffs] = useState<PendingDiff[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const threadIdRef = useRef<string | undefined>(undefined);

  // ── Fetch pending diffs from the DB (single source of truth) ──────────────
  const fetchPendingDiffs = useCallback(async () => {
    if (!vendorId) return;
    try {
      const res = await fetch(`${MASTRA_URL}/api/actions/pending`, {
        headers: { 'X-Vendor-Id': vendorId, 'X-Staff-Id': staffId },
      });
      if (!res.ok) return;
      const data = await res.json();
      const actions: PendingDiff[] = (data.actions ?? []).map((a: any) => ({
        log_id: a.log_id,
        action_type: a.resolved_action_type,
        message: a.request_text,
        proposed_diff: a.proposed_diff as PendingDiff['proposed_diff'],
      }));
      setPendingDiffs(actions);
    } catch (err) {
      console.error('Failed to fetch pending diffs:', err);
    }
  }, [vendorId, staffId]);

  // Poll on mount so any existing pending diffs are shown immediately
  useEffect(() => {
    fetchPendingDiffs();
  }, [fetchPendingDiffs]);

  // ── Send a chat message ────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch(`${MASTRA_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Vendor-Id': vendorId,
          'X-Staff-Id': staffId,
        },
        body: JSON.stringify({
          message: text,
          thread_id: threadIdRef.current,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');

      // Persist thread_id for multi-turn memory
      if (data.thread_id) threadIdRef.current = data.thread_id;

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.text,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      // After every response, re-fetch pending diffs from the DB.
      // Write tools now write directly to the audit log, so this will
      // surface any newly created pending diffs without parsing LLM output.
      await fetchPendingDiffs();
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `⚠️ Error: ${err instanceof Error ? err.message : 'Something went wrong'}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [vendorId, staffId, fetchPendingDiffs]);

  // ── Approve a pending diff ─────────────────────────────────────────────────
  const approve = useCallback(async (log_id: string) => {
    try {
      const res = await fetch(`${MASTRA_URL}/api/actions/${log_id}/approve`, {
        method: 'POST',
        headers: { 'X-Vendor-Id': vendorId, 'X-Staff-Id': staffId },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPendingDiffs(prev => prev.filter(d => d.log_id !== log_id));
        setMessages(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `✅ Action approved and executed successfully. ${data.detail || ''}`,
            timestamp: new Date(),
          },
        ]);
      }
    } catch (err) {
      console.error('Approve error:', err);
    }
  }, [vendorId, staffId]);

  // ── Reject a pending diff ──────────────────────────────────────────────────
  const reject = useCallback(async (log_id: string) => {
    try {
      await fetch(`${MASTRA_URL}/api/actions/${log_id}/reject`, {
        method: 'POST',
        headers: { 'X-Vendor-Id': vendorId, 'X-Staff-Id': staffId },
      });
      setPendingDiffs(prev => prev.filter(d => d.log_id !== log_id));
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `❌ Action rejected. No changes were made.`,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      console.error('Reject error:', err);
    }
  }, [vendorId, staffId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setPendingDiffs([]);
    threadIdRef.current = undefined;
  }, []);

  return { messages, pendingDiffs, isLoading, sendMessage, approve, reject, clearMessages };
}
