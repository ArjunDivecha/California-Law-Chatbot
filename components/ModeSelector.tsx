/**
 * ModeSelector Component
 * 
 * Toggle between Research (chat) and Drafting modes.
 */

import React from 'react';
import { FileText, Search, Sparkles } from 'lucide-react';
import type { AppMode } from '../types';

interface ModeSelectorProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  mode,
  onModeChange,
}) => {
  const options: Array<{ mode: AppMode; label: string; icon: React.ReactNode }> = [
    { mode: 'research', label: 'Research', icon: <Search size={13} /> },
    { mode: 'drafting', label: 'Drafting', icon: <FileText size={13} /> },
    { mode: 'magic', label: 'Drafting Magic', icon: <Sparkles size={13} /> },
  ];

  return (
    <div style={styles.container}>
      {options.map(option => (
        <button
          key={option.mode}
          onClick={() => onModeChange(option.mode)}
          style={{
            ...styles.button,
            ...(mode === option.mode ? styles.buttonActive : styles.buttonInactive),
          }}
        >
          <span style={styles.icon}>{option.icon}</span>
          <span>{option.label}</span>
        </button>
      ))}
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
    maxWidth: '100%',
    overflowX: 'auto',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
};

export default ModeSelector;
