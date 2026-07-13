import React from 'react';
import styles from './TypingIndicator.module.css';

export function TypingIndicator() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.avatar}>H</div>
      <div className={styles.bubble}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
    </div>
  );
}
