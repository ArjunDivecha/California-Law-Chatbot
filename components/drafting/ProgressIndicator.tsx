/**
 * ProgressIndicator Component
 * 
 * Shows document generation progress with phase indicator and completion status.
 */

import React from 'react';
import type { DocumentStatus } from '../../types';

interface ProgressIndicatorProps {
  status: DocumentStatus;
  progress: number;
  message: string;
  completedSections: string[];
  totalSections: number;
}

const phases: { id: DocumentStatus; label: string; icon: string }[] = [
  { id: 'researching', label: 'Research', icon: '🔍' },
  { id: 'drafting', label: 'Drafting', icon: '📝' },
  { id: 'verifying_citations', label: 'Citations', icon: '📋' },
  { id: 'final_verification', label: 'Verify', icon: '✓' },
  { id: 'complete', label: 'Complete', icon: '✅' },
];

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  status,
  progress,
  message,
  completedSections,
  totalSections,
}) => {
  const currentPhaseIndex = phases.findIndex((p) => p.id === status);

  return (
    <div style={styles.container}>
      {/* Phase indicators */}
      <div style={styles.phases}>
        {phases.map((phase, index) => {
          const isActive = phase.id === status;
          const isComplete = index < currentPhaseIndex;
          const isPending = index > currentPhaseIndex;

          return (
            <div key={phase.id} style={styles.phaseItem}>
              <div
                style={{
                  ...styles.phaseCircle,
                  ...(isComplete ? styles.phaseComplete : {}),
                  ...(isActive ? styles.phaseActive : {}),
                  ...(isPending ? styles.phasePending : {}),
                }}
              >
                {isComplete ? '✓' : phase.icon}
              </div>
              <span
                style={{
                  ...styles.phaseLabel,
                  ...(isActive ? styles.phaseLabelActive : {}),
                }}
              >
                {phase.label}
              </span>
              {index < phases.length - 1 && (
                <div
                  style={{
                    ...styles.phaseLine,
                    ...(isComplete ? styles.phaseLineComplete : {}),
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div style={styles.progressContainer}>
        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              width: `${progress}%`,
            }}
          />
        </div>
        <span style={styles.progressPercent}>{progress}%</span>
      </div>

      {/* Current message */}
      <p style={styles.message}>{message}</p>

      {/* Section completion */}
      {totalSections > 0 && (
        <div style={styles.sections}>
          <span style={styles.sectionCount}>
            Sections: {completedSections.length} / {totalSections}
          </span>
          <div style={styles.sectionDots}>
            {Array.from({ length: totalSections }).map((_, i) => (
              <div
                key={i}
                style={{
                  ...styles.sectionDot,
                  ...(i < completedSections.length ? styles.sectionDotComplete : {}),
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px',
    border: '1px solid #e5e7eb',
  },
  phases: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '24px',
    position: 'relative',
  },
  phaseItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    flex: 1,
  },
  phaseCircle: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    marginBottom: '8px',
    backgroundColor: '#f3f4f6',
    color: '#9ca3af',
    transition: 'all 0.3s ease',
  },
  phaseComplete: {
    backgroundColor: '#22c55e',
    color: '#ffffff',
  },
  phaseActive: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.2)',
  },
  phasePending: {
    backgroundColor: '#f3f4f6',
    color: '#9ca3af',
  },
  phaseLabel: {
    fontSize: '12px',
    color: '#9ca3af',
    fontWeight: 500,
  },
  phaseLabelActive: {
    color: '#3b82f6',
    fontWeight: 600,
  },
  phaseLine: {
    position: 'absolute',
    top: '20px',
    left: '60%',
    right: '-40%',
    height: '2px',
    backgroundColor: '#e5e7eb',
    zIndex: 0,
  },
  phaseLineComplete: {
    backgroundColor: '#22c55e',
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  progressBar: {
    flex: 1,
    height: '8px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  progressPercent: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#3b82f6',
    minWidth: '40px',
    textAlign: 'right',
  },
  message: {
    fontSize: '14px',
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: '16px',
  },
  sections: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
  },
  sectionCount: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  sectionDots: {
    display: 'flex',
    gap: '4px',
  },
  sectionDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#e5e7eb',
    transition: 'background-color 0.3s ease',
  },
  sectionDotComplete: {
    backgroundColor: '#22c55e',
  },
};

export default ProgressIndicator;
