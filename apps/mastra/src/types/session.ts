// src/types/session.ts
// Shared type definitions for session context and diffs

export interface SessionContext {
  vendor_id: string;
  staff_user_id: string;
  role: 'owner' | 'manager' | 'staff';
  active_tracks: ('play' | 'pass' | 'community')[];
  venue_ids: string[];
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
