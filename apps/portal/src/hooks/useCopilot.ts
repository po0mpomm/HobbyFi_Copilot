'use client';
import { useState, useCallback, useRef } from 'react';

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

export function useCopilot(vendorId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingDiffs, setPendingDiffs] = useState<PendingDiff[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const threadIdRef = useRef<string | undefined>(undefined);

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
          'X-Staff-Id': 'staff-demo-001',
        },
        body: JSON.stringify({
          message: text,
          thread_id: threadIdRef.current,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');

      threadIdRef.current = data.thread_id;

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.text,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      // If the response contains a pending diff (proposed action), save it to audit log
      if (data.proposed_diff) {
        const logRes = await fetch(`${MASTRA_URL}/api/actions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Vendor-Id': vendorId,
          },
          body: JSON.stringify({
            proposed_diff: data.proposed_diff,
            request_text: text,
            conversation_id: threadIdRef.current,
          }),
        });
        const logData = await logRes.json();
        if (logData.log_id) {
          setPendingDiffs(prev => [
            ...prev,
            {
              log_id: logData.log_id,
              action_type: data.proposed_diff.action_type,
              message: data.text,
              proposed_diff: data.proposed_diff,
            },
          ]);
        }
      }
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
  }, [vendorId]);

  const approve = useCallback(async (log_id: string) => {
    try {
      const res = await fetch(`${MASTRA_URL}/api/actions/${log_id}/approve`, {
        method: 'POST',
        headers: { 'X-Vendor-Id': vendorId },
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
  }, [vendorId]);

  const reject = useCallback(async (log_id: string) => {
    try {
      await fetch(`${MASTRA_URL}/api/actions/${log_id}/reject`, {
        method: 'POST',
        headers: { 'X-Vendor-Id': vendorId },
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
  }, [vendorId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setPendingDiffs([]);
    threadIdRef.current = undefined;
  }, []);

  return { messages, pendingDiffs, isLoading, sendMessage, approve, reject, clearMessages };
}
