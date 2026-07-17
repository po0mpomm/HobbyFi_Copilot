'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCopilot } from '@/hooks/useCopilot';
import { ChatMessage } from './ChatMessage';
import { TypingIndicator } from './TypingIndicator';
import { DiffCard } from './DiffCard';
import styles from './CopilotChat.module.css';

export function CopilotChat() {
  const { vendorId, vendorName, track, staffId } = useAuth();
  const { messages, pendingDiffs, isLoading, sendMessage, approve, reject, clearMessages } = useCopilot(vendorId, staffId);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingDiffs, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
  };

  return (
    <div className={`${styles.container} glass`}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <div className={styles.copilotLogo}>
            <span className={styles.sparkle}>✨</span>
          </div>
          <div>
            <h2 className="gradient-text">HobbyFi Copilot</h2>
            <p className={styles.vendorContext}>
              {vendorName} • <span className={styles.trackBadge}>{track.toUpperCase()}</span>
            </p>
          </div>
        </div>
        <button className="btn btn-ghost" onClick={clearMessages} title="Clear Chat">
          ↻
        </button>
      </div>

      <div className={styles.chatArea}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🤖</span>
            <h3>How can I help you today?</h3>
            <p>I can help you analyze revenue, manage bookings, or update memberships.</p>
            <div className={styles.suggestions}>
              <button className={styles.suggestionBtn} onClick={() => setInput('What is my revenue for this month?')}>
                What is my revenue for this month?
              </button>
              {track === 'play' ? (
                <button className={styles.suggestionBtn} onClick={() => setInput('Who is booked for tomorrow at 10 AM?')}>
                  Who is booked for tomorrow at 10 AM?
                </button>
              ) : (
                <button className={styles.suggestionBtn} onClick={() => setInput('Show me all active trials.')}>
                  Show me all active trials.
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.messageList}>
            {messages.map(msg => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            
            {pendingDiffs.map(diff => (
              <DiffCard
                key={diff.log_id}
                diff={diff}
                onApprove={approve}
                onReject={reject}
              />
            ))}
            
            {isLoading && <TypingIndicator />}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <form className={styles.inputArea} onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Copilot anything..."
          className={styles.inputField}
          disabled={isLoading}
        />
        <button type="submit" className="btn btn-primary" disabled={!input.trim() || isLoading}>
          ↑
        </button>
      </form>
    </div>
  );
}
