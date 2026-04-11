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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    padding: '4px',
    gap: '4px',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    fontSize: '12px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    lineHeight: 1,
  },
  buttonActive: {
    backgroundColor: '#111827',
    color: '#ffffff',
    boxShadow: 'none',
  },
  buttonInactive: {
    backgroundColor: '#ffffff',
    color: '#1f2937',
  },
  icon: {
    fontSize: '12px',
    lineHeight: 1,
  },
};

export default ModeSelector;
