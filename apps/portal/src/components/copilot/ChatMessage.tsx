'use client';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './ChatMessage.module.css';
import type { Message } from '@/hooks/useCopilot';

interface Props {
  message: Message;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`${styles.wrapper} ${isUser ? styles.user : styles.assistant}`}>
      {!isUser && (
        <div className={styles.avatar}>H</div>
      )}
      <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}>
        {isUser ? (
          <p className={styles.text}>{message.content}</p>
        ) : (
          <div className={styles.markdown}>
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        <span className={styles.time}>
          {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      {isUser && (
        <div className={`${styles.avatar} ${styles.userAvatar}`}>U</div>
      )}
    </div>
  );
}
