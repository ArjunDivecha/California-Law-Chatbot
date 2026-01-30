/**
 * DocumentPreview Component
 * 
 * Displays the generated document with section navigation and edit controls.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { GeneratedDocument, GeneratedSection } from '../../types';

interface DocumentPreviewProps {
  document: GeneratedDocument | null;
  sections: GeneratedSection[];
  selectedSection: string | null;
  onSectionClick: (sectionId: string) => void;
  isGenerating: boolean;
  generatingSection?: string;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  document,
  sections,
  selectedSection,
  onSectionClick,
  isGenerating,
  generatingSection,
}) => {
  if (sections.length === 0 && !isGenerating) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>📄</div>
        <h3 style={styles.emptyTitle}>Document Preview</h3>
        <p style={styles.emptyText}>
          Select a template and enter your instructions to generate a document
        </p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Document header */}
      {document && (
        <div style={styles.header}>
          <h2 style={styles.title}>{document.templateName}</h2>
          <div style={styles.meta}>
            <span>{document.wordCount} words</span>
            <span>~{document.pageEstimate} pages</span>
            {document.verificationReport && (
              <span style={styles.score}>
                Score: {document.verificationReport.overallScore}/100
              </span>
            )}
          </div>
        </div>
      )}

      {/* Sections */}
      <div style={styles.content}>
        {sections.map((section) => {
          const isSelected = selectedSection === section.sectionId;
          const isGeneratingThis = generatingSection === section.sectionId;

          return (
            <div
              key={section.sectionId}
              onClick={() => onSectionClick(section.sectionId)}
              style={{
                ...styles.section,
                ...(isSelected ? styles.sectionSelected : {}),
                ...(isGeneratingThis ? styles.sectionGenerating : {}),
              }}
            >
              <div style={styles.sectionHeader}>
                <h3 style={styles.sectionTitle}>{section.sectionName}</h3>
                <div style={styles.sectionMeta}>
                  <span>{section.wordCount} words</span>
                  {section.revisionCount > 0 && (
                    <span style={styles.revisionBadge}>
                      Revised {section.revisionCount}x
                    </span>
                  )}
                </div>
              </div>
              <div style={styles.sectionContent}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {section.content}
                </ReactMarkdown>
              </div>
              {isSelected && (
                <div style={styles.editHint}>
                  Click to revise this section
                </div>
              )}
            </div>
          );
        })}

        {/* Generating skeleton */}
        {isGenerating && generatingSection && (
          <div style={styles.skeleton}>
            <div style={styles.skeletonPulse} />
            <div style={{ ...styles.skeletonPulse, width: '80%' }} />
            <div style={{ ...styles.skeletonPulse, width: '60%' }} />
          </div>
        )}
      </div>

      {/* Verification report */}
      {document?.verificationReport && (
        <div style={styles.verification}>
          <h4 style={styles.verificationTitle}>Verification Report</h4>
          <div style={styles.verificationStats}>
            <div style={styles.stat}>
              <span style={styles.statValue}>
                {document.verificationReport.supportedClaims}
              </span>
              <span style={styles.statLabel}>Supported</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statValue}>
                {document.verificationReport.unsupportedClaims}
              </span>
              <span style={styles.statLabel}>Unsupported</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statValue}>
                {document.verificationReport.issues.length}
              </span>
              <span style={styles.statLabel}>Issues</span>
            </div>
          </div>
          {document.verificationReport.issues.length > 0 && (
            <div style={styles.issues}>
              {document.verificationReport.issues.slice(0, 3).map((issue) => (
                <div
                  key={issue.id}
                  style={{
                    ...styles.issue,
                    borderLeftColor:
                      issue.severity === 'error'
                        ? '#ef4444'
                        : issue.severity === 'warning'
                        ? '#f59e0b'
                        : '#3b82f6',
                  }}
                >
                  <span style={styles.issueSeverity}>
                    {issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : '💡'}
                  </span>
                  <span>{issue.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 32px',
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    border: '2px dashed #e5e7eb',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: '8px',
  },
  emptyText: {
    fontSize: '14px',
    color: '#6b7280',
    textAlign: 'center',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: '8px',
  },
  meta: {
    display: 'flex',
    gap: '16px',
    fontSize: '13px',
    color: '#6b7280',
  },
  score: {
    fontWeight: 600,
    color: '#22c55e',
  },
  content: {
    padding: '24px',
    maxHeight: '600px',
    overflowY: 'auto',
  },
  section: {
    padding: '16px',
    marginBottom: '16px',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  sectionSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  sectionGenerating: {
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1f2937',
    textTransform: 'uppercase',
  },
  sectionMeta: {
    display: 'flex',
    gap: '12px',
    fontSize: '12px',
    color: '#9ca3af',
  },
  revisionBadge: {
    backgroundColor: '#dbeafe',
    color: '#3b82f6',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: 500,
  },
  sectionContent: {
    fontSize: '14px',
    lineHeight: 1.6,
    color: '#374151',
  },
  editHint: {
    marginTop: '12px',
    fontSize: '12px',
    color: '#3b82f6',
    fontStyle: 'italic',
  },
  skeleton: {
    padding: '16px',
  },
  skeletonPulse: {
    height: '12px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    marginBottom: '8px',
    animation: 'pulse 1.5s infinite',
  },
  verification: {
    padding: '20px 24px',
    borderTop: '1px solid #e5e7eb',
    backgroundColor: '#f9fafb',
  },
  verificationTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: '12px',
  },
  verificationStats: {
    display: 'flex',
    gap: '24px',
    marginBottom: '16px',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1f2937',
  },
  statLabel: {
    fontSize: '12px',
    color: '#6b7280',
  },
  issues: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  issue: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: '#ffffff',
    borderRadius: '6px',
    borderLeft: '3px solid',
    fontSize: '13px',
    color: '#374151',
  },
  issueSeverity: {
    flexShrink: 0,
  },
};

export default DocumentPreview;
