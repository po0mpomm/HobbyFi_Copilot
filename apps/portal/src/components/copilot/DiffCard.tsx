'use client';
import React from 'react';
import styles from './DiffCard.module.css';
import type { PendingDiff } from '@/hooks/useCopilot';

interface Props {
  diff: PendingDiff;
  onApprove: (log_id: string) => void;
  onReject: (log_id: string) => void;
}

export function DiffCard({ diff, onApprove, onReject }: Props) {
  const { proposed_diff } = diff;
  const isExtraConfirmation = proposed_diff.requires_extra_confirmation;

  const formatValue = (val: unknown): string => {
    if (val instanceof Date) return val.toLocaleDateString();
    if (typeof val === 'object' && val !== null) return JSON.stringify(val);
    return String(val);
  };

  return (
    <div className={`${styles.card} ${isExtraConfirmation ? styles.danger : ''}`}>
      <div className={styles.header}>
        <div className={styles.actionBadge}>
          {proposed_diff.action_type.replace(/_/g, ' ').toUpperCase()}
        </div>
        {isExtraConfirmation && (
          <div className={styles.warningBadge}>⚠️ Extra Confirmation Required</div>
        )}
      </div>

      <div className={styles.diffGrid}>
        <div className={styles.diffCol}>
          <span className={styles.label}>Current</span>
          {Object.entries(proposed_diff.current_value).map(([k, v]) => (
            <div key={k} className={styles.diffValue}>
              <span className={styles.fieldName}>{k}:</span>
              <span className={styles.currentVal}>{formatValue(v)}</span>
            </div>
          ))}
        </div>
        <div className={styles.arrow}>→</div>
        <div className={styles.diffCol}>
          <span className={styles.label}>Proposed</span>
          {Object.entries(proposed_diff.proposed_value).map(([k, v]) => (
            <div key={k} className={styles.diffValue}>
              <span className={styles.fieldName}>{k}:</span>
              <span className={styles.proposedVal}>{formatValue(v)}</span>
            </div>
          ))}
        </div>
      </div>

      {proposed_diff.downstream_effects && proposed_diff.downstream_effects.length > 0 && (
        <div className={styles.effects}>
          <span className={styles.effectsLabel}>Downstream effects:</span>
          <ul>
            {proposed_diff.downstream_effects.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.actions}>
        <button
          className="btn btn-success"
          onClick={() => onApprove(diff.log_id)}
          id={`approve-${diff.log_id}`}
        >
          ✓ Approve
        </button>
        <button
          className="btn btn-danger"
          onClick={() => onReject(diff.log_id)}
          id={`reject-${diff.log_id}`}
        >
          ✕ Reject
        </button>
      </div>
    </div>
  );
}
