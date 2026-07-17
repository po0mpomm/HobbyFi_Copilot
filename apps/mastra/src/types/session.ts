// src/types/session.ts
// Shared type definitions for session context and diffs

export interface SessionContext {
  vendor_id: string;
  staff_user_id: string;
  role: 'owner' | 'manager' | 'staff';
  active_tracks: ('play' | 'pass' | 'community')[];
  venue_ids: string[];
  // Populated per-request in the /api/chat handler so write tools can
  // call createAuditEntry() directly without routing data through the LLM.
  request_text: string;
  thread_id?: string;
}

export interface ProposedDiff {
  action_type: string;
  target_entity_type: string;
  target_entity_id: string;
  current_value: Record<string, unknown>;
  proposed_value: Record<string, unknown>;
  downstream_effects?: string[];
  requires_extra_confirmation?: boolean;
}
