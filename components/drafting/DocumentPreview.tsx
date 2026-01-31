/**
 * DocumentPreview Component
 * 
 * Displays the generated document with WYSIWYG inline editing.
 * After generation completes, all sections are editable in place.
 * Changes persist and are used for export.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { GeneratedDocument, GeneratedSection } from '../../types';

interface DocumentPreviewProps {
  document: GeneratedDocument | null;
  sections: GeneratedSection[];
  selectedSection: string | null;
  onSectionClick: (sectionId: string) => void;
  onSectionEdit?: (sectionId: string, newContent: string) => void;
  isGenerating: boolean;
  generatingSection?: string;
  isComplete?: boolean;
}

/**
 * Convert markdown to HTML for WYSIWYG display
 */
function markdownToHtml(markdown: string): string {
  let html = markdown;
  
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Links
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  
  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');
  
  // Lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  
  // Paragraphs - split by double newlines
  const blocks = html.split(/\n\n+/);
  html = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    // Don't wrap elements that are already block-level
    if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<hr') || trimmed.startsWith('<p')) {
      return trimmed;
    }
    return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
  
  return html;
}

/**
 * Convert HTML back to markdown for storage
 */
function htmlToMarkdown(html: string): string {
  let md = html;
  
  // Remove line breaks within paragraphs (we'll handle with proper newlines)
  md = md.replace(/<br\s*\/?>/gi, '\n');
  
  // Headers
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1');
  
  // Bold and italic
  md = md.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i>(.*?)<\/i>/gi, '*$1*');
  
  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  
  // Lists
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1');
  md = md.replace(/<\/?ul[^>]*>/gi, '');
  md = md.replace(/<\/?ol[^>]*>/gi, '');
  
  // Paragraphs and divs
  md = md.replace(/<\/p>/gi, '\n\n');
  md = md.replace(/<p[^>]*>/gi, '');
  md = md.replace(/<\/div>/gi, '\n');
  md = md.replace(/<div[^>]*>/gi, '');
  
  // Horizontal rules
  md = md.replace(/<hr[^>]*>/gi, '\n---\n');
  
  // Clean up spans and other inline elements
  md = md.replace(/<\/?span[^>]*>/gi, '');
  
  // Clean up extra whitespace
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.trim();
  
  return md;
}

/**
 * Editable Section Component
 */
const EditableSection: React.FC<{
  section: GeneratedSection;
  isSelected: boolean;
  isGenerating: boolean;
  isEditable: boolean;
  onSelect: () => void;
  onEdit: (newContent: string) => void;
}> = ({ section, isSelected, isGenerating, isEditable, onSelect, onEdit }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [localHtml, setLocalHtml] = useState('');
  
  // Initialize HTML content
  useEffect(() => {
    setLocalHtml(markdownToHtml(section.content));
  }, [section.content]);
  
  // Handle blur - save content
  const handleBlur = useCallback(() => {
    if (contentRef.current && isEditing) {
      const newHtml = contentRef.current.innerHTML;
      const newMarkdown = htmlToMarkdown(newHtml);
      if (newMarkdown !== section.content) {
        onEdit(newMarkdown);
      }
      setIsEditing(false);
    }
  }, [isEditing, onEdit, section.content]);
  
  // Handle focus - enter editing mode
  const handleFocus = useCallback(() => {
    if (isEditable) {
      setIsEditing(true);
      onSelect();
    }
  }, [isEditable, onSelect]);
  
  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Bold: Cmd/Ctrl + B
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      document.execCommand('bold', false);
    }
    // Italic: Cmd/Ctrl + I
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
      e.preventDefault();
      document.execCommand('italic', false);
    }
  }, []);

  return (
    <div
      onClick={onSelect}
      style={{
        ...styles.section,
        ...(isSelected ? styles.sectionSelected : {}),
        ...(isGenerating ? styles.sectionGenerating : {}),
        ...(isEditable && !isEditing ? styles.sectionEditable : {}),
        ...(isEditing ? styles.sectionEditing : {}),
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
          {isEditing && (
            <span style={styles.editingBadge}>Editing</span>
          )}
        </div>
      </div>
      
      {/* WYSIWYG Editable Content */}
      <div
        ref={contentRef}
        contentEditable={isEditable}
        suppressContentEditableWarning
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        dangerouslySetInnerHTML={{ __html: localHtml }}
        style={{
          ...styles.sectionContent,
          ...(isEditable ? styles.sectionContentEditable : {}),
          ...(isEditing ? styles.sectionContentEditing : {}),
        }}
      />
      
      {/* Edit hint */}
      {isEditable && !isEditing && (
        <div style={styles.editHint}>
          ✏️ Click to edit • Cmd/Ctrl+B for bold • Cmd/Ctrl+I for italic
        </div>
      )}
    </div>
  );
};

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  document,
  sections,
  selectedSection,
  onSectionClick,
  onSectionEdit,
  isGenerating,
  generatingSection,
  isComplete = false,
}) => {
  // Track if editing is enabled (after generation completes)
  const isEditable = isComplete && !isGenerating;
  
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
          <div style={styles.headerTop}>
            <h2 style={styles.title}>{document.templateName}</h2>
            {isEditable && (
              <div style={styles.editModeIndicator}>
                ✏️ Edit Mode Active
              </div>
            )}
          </div>
          <div style={styles.meta}>
            <span>{document.wordCount} words</span>
            <span>~{document.pageEstimate} pages</span>
            {document.verificationReport && (
              <span style={styles.score}>
                Score: {document.verificationReport.overallScore}/100
              </span>
            )}
          </div>
          {isEditable && (
            <div style={styles.editInstructions}>
              Click any section to edit directly. Changes are saved automatically when you click away.
            </div>
          )}
        </div>
      )}

      {/* Sections */}
      <div style={styles.content}>
        {sections.map((section) => (
          <EditableSection
            key={section.sectionId}
            section={section}
            isSelected={selectedSection === section.sectionId}
            isGenerating={generatingSection === section.sectionId}
            isEditable={isEditable}
            onSelect={() => onSectionClick(section.sectionId)}
            onEdit={(newContent) => onSectionEdit?.(section.sectionId, newContent)}
          />
        ))}

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
  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#1f2937',
  },
  editModeIndicator: {
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 600,
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
  editInstructions: {
    marginTop: '12px',
    padding: '8px 12px',
    backgroundColor: '#eff6ff',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#1d4ed8',
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
    transition: 'all 0.2s ease',
  },
  sectionEditable: {
    cursor: 'text',
    borderStyle: 'dashed',
  },
  sectionEditing: {
    borderColor: '#3b82f6',
    borderStyle: 'solid',
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)',
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
  editingBadge: {
    backgroundColor: '#dcfce7',
    color: '#16a34a',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: 500,
  },
  sectionContent: {
    fontSize: '14px',
    lineHeight: 1.7,
    color: '#374151',
    outline: 'none',
  },
  sectionContentEditable: {
    minHeight: '60px',
  },
  sectionContentEditing: {
    backgroundColor: '#ffffff',
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #e5e7eb',
  },
  editHint: {
    marginTop: '12px',
    fontSize: '12px',
    color: '#9ca3af',
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
