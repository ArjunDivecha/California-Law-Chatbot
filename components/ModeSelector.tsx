/**
 * ModeSelector Component
 * 
 * Toggle between Research (chat) and Drafting modes.
 */

import React from 'react';
import type { AppMode } from '../types';

interface ModeSelectorProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  mode,
  onModeChange,
}) => {
  return (
    <div style={styles.container}>
      <button
        onClick={() => onModeChange('research')}
        style={{
          ...styles.button,
          ...(mode === 'research' ? styles.buttonActive : styles.buttonInactive),
        }}
      >
        <span style={styles.icon}>🔍</span>
        <span>Research</span>
      </button>
      <button
        onClick={() => onModeChange('drafting')}
        style={{
          ...styles.button,
          ...(mode === 'drafting' ? styles.buttonActive : styles.buttonInactive),
        }}
      >
        <span style={styles.icon}>📝</span>
        <span>Drafting</span>
      </button>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    backgroundColor: '#f3f4f6',
    borderRadius: '10px',
    padding: '4px',
    gap: '4px',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  buttonActive: {
    backgroundColor: '#ffffff',
    color: '#1f2937',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  buttonInactive: {
    backgroundColor: 'transparent',
    color: '#6b7280',
  },
  icon: {
    fontSize: '16px',
  },
};

export default ModeSelector;
