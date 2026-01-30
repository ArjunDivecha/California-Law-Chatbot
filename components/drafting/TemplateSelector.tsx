/**
 * TemplateSelector Component
 * 
 * Displays available document templates for selection.
 */

import React from 'react';
import type { TemplateSummary } from '../../types';

interface TemplateSelectorProps {
  templates: TemplateSummary[];
  selectedId: string | null;
  onSelect: (templateId: string) => void;
  loading?: boolean;
}

const complexityColors: Record<string, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
};

const complexityLabels: Record<string, string> = {
  low: 'Simple',
  medium: 'Medium',
  high: 'Complex',
};

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  templates,
  selectedId,
  onSelect,
  loading,
}) => {
  if (loading) {
    return (
      <div style={styles.container}>
        <h3 style={styles.title}>Select Document Type</h3>
        <div style={styles.loading}>Loading templates...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Select Document Type</h3>
      <div style={styles.grid}>
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(template.id)}
            style={{
              ...styles.card,
              ...(selectedId === template.id ? styles.cardSelected : {}),
            }}
          >
            <div style={styles.cardHeader}>
              <span style={styles.cardName}>{template.name}</span>
              <span
                style={{
                  ...styles.complexity,
                  backgroundColor: complexityColors[template.complexity] + '20',
                  color: complexityColors[template.complexity],
                }}
              >
                {complexityLabels[template.complexity]}
              </span>
            </div>
            <p style={styles.cardDescription}>{template.description}</p>
            <div style={styles.cardMeta}>
              <span>{template.estimatedTime}</span>
              <span>{template.sectionCount} sections</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: '16px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '12px',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '16px',
    background: '#ffffff',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s ease',
  },
  cardSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: '8px',
  },
  cardName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1f2937',
  },
  complexity: {
    fontSize: '11px',
    fontWeight: 500,
    padding: '2px 8px',
    borderRadius: '12px',
  },
  cardDescription: {
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '12px',
    lineHeight: 1.4,
  },
  cardMeta: {
    display: 'flex',
    gap: '16px',
    fontSize: '12px',
    color: '#9ca3af',
  },
  loading: {
    padding: '32px',
    textAlign: 'center',
    color: '#6b7280',
  },
};

export default TemplateSelector;
