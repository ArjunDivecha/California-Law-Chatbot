/**
 * DraftingMode Component
 * 
 * Main container for the document drafting workflow.
 */

import React, { useEffect, useState } from 'react';
import { useDrafting } from '../../hooks/useDrafting';
import { TemplateSelector } from './TemplateSelector';
import { VariableInputPanel } from './VariableInputPanel';
import { ProgressIndicator } from './ProgressIndicator';
import { DocumentPreview } from './DocumentPreview';
import { OrchestrationVisual } from './OrchestrationVisual';

interface DraftingModeProps {
  onModeChange?: () => void;
}

export const DraftingMode: React.FC<DraftingModeProps> = ({ onModeChange }) => {
  const {
    // Template state
    templates,
    templatesLoading,
    selectedTemplateId,
    template,
    
    // Variable state
    variables,
    
    // Document state
    document,
    sections,
    status,
    progress,
    progressMessage,
    generatingSection,
    
    // Error state
    error,
    
    // Selected section
    selectedSection,
    
    // Actions
    loadTemplates,
    selectTemplate,
    setVariables,
    startGeneration,
    reviseSection,
    selectSection,
    exportDocument,
    reset,
  } = useDrafting();

  // Local state for instructions
  const [instructions, setInstructions] = useState('');
  const [revisionInstructions, setRevisionInstructions] = useState('');
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [showOrchestration, setShowOrchestration] = useState(true); // Toggle for orchestration view

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Check if variables are complete
  const isVariablesComplete = template?.variables
    .filter((v) => v.required)
    .every((v) => variables[v.id]?.trim());

  // Check if ready to generate
  const canGenerate = selectedTemplateId && isVariablesComplete && instructions.trim() && status !== 'drafting' && status !== 'researching';

  // Check if generating
  const isGenerating = status === 'researching' || status === 'drafting' || status === 'verifying_citations' || status === 'final_verification';

  // Handle generate
  const handleGenerate = async () => {
    if (!canGenerate) return;
    await startGeneration(instructions);
  };

  // Handle section click
  const handleSectionClick = (sectionId: string) => {
    if (status !== 'complete') return;
    selectSection(sectionId);
    setShowRevisionInput(true);
    setRevisionInstructions('');
  };

  // Handle revision submit
  const handleRevisionSubmit = async () => {
    if (!selectedSection || !revisionInstructions.trim()) return;
    await reviseSection(selectedSection, revisionInstructions);
    setShowRevisionInput(false);
    setRevisionInstructions('');
  };

  // Handle export
  const handleExport = (format: 'html' | 'pdf') => {
    exportDocument(format);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>Document Drafting</h1>
          <p style={styles.subtitle}>Generate legal documents with AI assistance</p>
        </div>
        <div style={styles.headerRight}>
          {document && status === 'complete' && (
            <div style={styles.exportButtons}>
              <button
                onClick={() => handleExport('html')}
                style={styles.exportButton}
              >
                📄 Export HTML
              </button>
              <button
                onClick={() => handleExport('pdf')}
                style={styles.exportButtonPrimary}
              >
                🖨️ Print / PDF
              </button>
            </div>
          )}
          <button onClick={reset} style={styles.resetButton}>
            🔄 New Document
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div style={styles.error}>
          <span>❌ {error}</span>
          <button onClick={() => reset()} style={styles.errorDismiss}>
            Dismiss
          </button>
        </div>
      )}

      {/* Main content */}
      <div style={styles.content}>
        {/* Left panel - Controls */}
        <div style={styles.leftPanel}>
          {/* Template selector */}
          <TemplateSelector
            templates={templates}
            selectedId={selectedTemplateId}
            onSelect={selectTemplate}
            loading={templatesLoading}
          />

          {/* Variable input */}
          {template && (
            <VariableInputPanel
              variables={template.variables}
              values={variables}
              onChange={setVariables}
              disabled={isGenerating}
            />
          )}

          {/* Instructions input */}
          {template && (
            <div style={styles.instructionsPanel}>
              <h3 style={styles.panelTitle}>Document Instructions</h3>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Describe what you want the document to cover. For example: 'Analyze whether a revocable living trust protects assets from creditors under California law...'"
                style={styles.instructionsInput}
                rows={4}
                disabled={isGenerating}
              />
              <button
                onClick={handleGenerate}
                disabled={!canGenerate || isGenerating}
                style={{
                  ...styles.generateButton,
                  ...((!canGenerate || isGenerating) ? styles.generateButtonDisabled : {}),
                }}
              >
                {isGenerating ? '⏳ Generating...' : '✨ Generate Document'}
              </button>
            </div>
          )}

          {/* Progress indicator */}
          {isGenerating && (
            <ProgressIndicator
              status={status}
              progress={progress}
              message={progressMessage}
              completedSections={sections.map((s) => s.sectionId)}
              totalSections={template?.sections.length || 0}
            />
          )}
        </div>

        {/* Right panel - Preview / Orchestration */}
        <div style={styles.rightPanel}>
          {/* Toggle button for orchestration view */}
          {isGenerating && (
            <div style={styles.viewToggle}>
              <button
                onClick={() => setShowOrchestration(true)}
                style={{
                  ...styles.toggleButton,
                  ...(showOrchestration ? styles.toggleButtonActive : {}),
                }}
              >
                🎯 Orchestration View
              </button>
              <button
                onClick={() => setShowOrchestration(false)}
                style={{
                  ...styles.toggleButton,
                  ...(!showOrchestration ? styles.toggleButtonActive : {}),
                }}
              >
                📄 Document Preview
              </button>
            </div>
          )}

          {/* Show orchestration visual when generating and toggle is on */}
          {isGenerating && showOrchestration ? (
            <OrchestrationVisual
              isGenerating={isGenerating}
              progress={progress}
              progressMessage={progressMessage}
              currentPhase={status}
              currentSection={generatingSection || undefined}
              sections={sections}
              verificationScore={document?.verificationReport?.overallScore}
            />
          ) : (
            <DocumentPreview
              document={document}
              sections={sections}
              selectedSection={selectedSection}
              onSectionClick={handleSectionClick}
              isGenerating={isGenerating}
              generatingSection={generatingSection || undefined}
            />
          )}

          {/* Revision input */}
          {showRevisionInput && selectedSection && !isGenerating && (
            <div style={styles.revisionPanel}>
              <h4 style={styles.revisionTitle}>
                Revise: {sections.find((s) => s.sectionId === selectedSection)?.sectionName}
              </h4>
              <textarea
                value={revisionInstructions}
                onChange={(e) => setRevisionInstructions(e.target.value)}
                placeholder="Describe the changes you want. For example: 'Make this section more detailed' or 'Add more case citations'..."
                style={styles.revisionInput}
                rows={3}
              />
              <div style={styles.revisionButtons}>
                <button
                  onClick={() => {
                    setShowRevisionInput(false);
                    selectSection(null);
                  }}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRevisionSubmit}
                  disabled={!revisionInstructions.trim() || generatingSection !== null}
                  style={{
                    ...styles.reviseButton,
                    ...(!revisionInstructions.trim() ? styles.reviseButtonDisabled : {}),
                  }}
                >
                  {generatingSection ? '⏳ Revising...' : '✏️ Revise Section'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confidentiality warning */}
      <div style={styles.warning}>
        <span>⚠️</span>
        <span>
          <strong>Confidentiality Warning:</strong> Do not enter confidential client information.
          Use placeholders like [CLIENT NAME] instead. All generated documents require attorney review.
        </span>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#f9fafb',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e5e7eb',
  },
  headerLeft: {},
  headerRight: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#1f2937',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
  },
  exportButtons: {
    display: 'flex',
    gap: '8px',
  },
  exportButton: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
    backgroundColor: '#ffffff',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  exportButtonPrimary: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#ffffff',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  resetButton: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#6b7280',
    backgroundColor: 'transparent',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  error: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    backgroundColor: '#fef2f2',
    borderBottom: '1px solid #fecaca',
    color: '#dc2626',
    fontSize: '14px',
  },
  errorDismiss: {
    padding: '4px 12px',
    fontSize: '12px',
    color: '#dc2626',
    backgroundColor: 'transparent',
    border: '1px solid #dc2626',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  content: {
    display: 'grid',
    gridTemplateColumns: '400px 1fr',
    gap: '24px',
    padding: '24px',
    flex: 1,
    overflow: 'hidden',
  },
  leftPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    overflowY: 'auto',
  },
  rightPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    overflowY: 'auto',
  },
  instructionsPanel: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #e5e7eb',
  },
  panelTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: '12px',
  },
  instructionsInput: {
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    resize: 'vertical',
    fontFamily: 'inherit',
    marginBottom: '12px',
  },
  generateButton: {
    width: '100%',
    padding: '12px 24px',
    fontSize: '15px',
    fontWeight: 600,
    color: '#ffffff',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  generateButtonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
  },
  revisionPanel: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    border: '2px solid #3b82f6',
  },
  revisionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: '12px',
  },
  revisionInput: {
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    resize: 'vertical',
    fontFamily: 'inherit',
    marginBottom: '12px',
  },
  revisionButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#6b7280',
    backgroundColor: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  reviseButton: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#ffffff',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  reviseButtonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
  },
  warning: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    padding: '12px 24px',
    backgroundColor: '#fffbeb',
    borderTop: '1px solid #fcd34d',
    fontSize: '13px',
    color: '#92400e',
  },
  viewToggle: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  toggleButton: {
    flex: 1,
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  toggleButtonActive: {
    color: '#ffffff',
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
};

export default DraftingMode;
