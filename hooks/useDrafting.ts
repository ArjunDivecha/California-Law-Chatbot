/**
 * useDrafting Hook
 * 
 * State management for the document drafting workflow.
 */

import { useState, useCallback, useRef } from 'react';
import type {
  DocumentTemplate,
  GeneratedDocument,
  GeneratedSection,
  DocumentStatus,
  DraftRequest,
  DraftOptions,
  TemplateSummary,
  VariableDefinition,
} from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface UseDraftingReturn {
  // Template state
  templates: TemplateSummary[];
  templatesLoading: boolean;
  selectedTemplateId: string | null;
  template: DocumentTemplate | null;
  
  // Variable state
  variables: Record<string, string>;
  
  // Document state
  document: GeneratedDocument | null;
  sections: GeneratedSection[];
  status: DocumentStatus;
  progress: number;
  progressMessage: string;
  generatingSection: string | null;
  
  // Error state
  error: string | null;
  
  // Selected section for revision
  selectedSection: string | null;
  
  // Actions
  loadTemplates: () => Promise<void>;
  selectTemplate: (templateId: string) => Promise<void>;
  setVariables: (variables: Record<string, string>) => void;
  startGeneration: (instructions: string) => Promise<void>;
  reviseSection: (sectionId: string, instructions: string) => Promise<void>;
  selectSection: (sectionId: string | null) => void;
  exportDocument: (format: 'html' | 'pdf') => Promise<void>;
  reset: () => void;
}

// =============================================================================
// FALLBACK DATA FOR DEVELOPMENT
// =============================================================================

const FALLBACK_TEMPLATES: TemplateSummary[] = [
  {
    id: 'legal_memo',
    name: 'Legal Research Memorandum',
    description: 'Internal legal memorandum analyzing a legal question with IRAC/CREAC structure',
    practiceAreas: ['all'],
    complexity: 'medium',
    estimatedTime: '60-90 seconds',
    variableCount: 5,
    sectionCount: 6,
  },
  {
    id: 'demand_letter',
    name: 'Demand Letter',
    description: 'Formal demand letter for payment, performance, or cease and desist',
    practiceAreas: ['civil_litigation', 'business'],
    complexity: 'low',
    estimatedTime: '30-45 seconds',
    variableCount: 10,
    sectionCount: 7,
  },
  {
    id: 'client_letter',
    name: 'Client Advisory Letter',
    description: 'Letter advising client on legal matter, options, and recommendations',
    practiceAreas: ['all'],
    complexity: 'low',
    estimatedTime: '30-45 seconds',
    variableCount: 8,
    sectionCount: 7,
  },
];

const FALLBACK_TEMPLATE_MEMO: DocumentTemplate = {
  id: 'legal_memo',
  name: 'Legal Research Memorandum',
  description: 'Internal legal memorandum analyzing a legal question',
  practiceAreas: ['all'],
  cebCategories: ['trusts_estates', 'family_law', 'business_litigation'],
  variables: [
    { id: 'to', name: 'To', type: 'text', required: true, placeholder: 'Partner Name' },
    { id: 'from', name: 'From', type: 'text', required: true, placeholder: 'Associate Name' },
    { id: 'client_matter', name: 'Client/Matter', type: 'text', required: true, placeholder: 'Client Name / Matter Description' },
    { id: 'date', name: 'Date', type: 'date', required: true, default: 'today' },
    { id: 'subject', name: 'Re (Subject)', type: 'text', required: true, placeholder: 'Subject of memorandum' },
  ],
  sections: [
    { id: 'header', name: 'Header', order: 1, type: 'template', content: '# MEMORANDUM\n\n**TO:** {{to}}\n\n**FROM:** {{from}}\n\n**DATE:** {{date}}\n\n**RE:** {{subject}}\n\n**CLIENT/MATTER:** {{client_matter}}\n\n---', required: true, editable: false },
    { id: 'question_presented', name: 'Question Presented', order: 2, type: 'generated', promptInstruction: 'Write a clear statement of the legal question(s) to be analyzed.', maxLengthWords: 150, required: true },
    { id: 'brief_answer', name: 'Brief Answer', order: 3, type: 'generated', promptInstruction: 'Provide a direct answer to the question presented.', maxLengthWords: 200, required: true },
    { id: 'facts', name: 'Statement of Facts', order: 4, type: 'generated', promptInstruction: 'Present the relevant facts.', maxLengthWords: 500, required: true },
    { id: 'analysis', name: 'Analysis', order: 5, type: 'generated', promptInstruction: 'Provide detailed legal analysis.', maxLengthWords: 2000, required: true, subsectionsAllowed: true },
    { id: 'conclusion', name: 'Conclusion', order: 6, type: 'generated', promptInstruction: 'Summarize and provide recommendations.', maxLengthWords: 300, required: true },
  ],
  formatting: { fontFamily: 'Times New Roman', fontSize: 12, lineSpacing: 'double', margins: { top: 1, bottom: 1, left: 1, right: 1 }, pageNumbers: true, headerStyle: 'left' },
  metadata: { version: '1.0', created: '2026-01-30', author: 'California Law Chatbot' },
};

// =============================================================================
// HOOK
// =============================================================================

export function useDrafting(): UseDraftingReturn {
  // Template state
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  
  // Variable state
  const [variables, setVariablesState] = useState<Record<string, string>>({});
  
  // Document state
  const [document, setDocument] = useState<GeneratedDocument | null>(null);
  const [sections, setSections] = useState<GeneratedSection[]>([]);
  const [status, setStatus] = useState<DocumentStatus>('initializing');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  // Selected section
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  
  // Event source ref for cleanup
  const eventSourceRef = useRef<EventSource | null>(null);

  // ==========================================================================
  // LOAD TEMPLATES
  // ==========================================================================
  
  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/templates');
      if (!response.ok) throw new Error('Failed to load templates');
      
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err) {
      // Fallback to embedded templates for development
      console.warn('Using fallback templates (API not available)');
      setTemplates(FALLBACK_TEMPLATES);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  // ==========================================================================
  // SELECT TEMPLATE
  // ==========================================================================
  
  const selectTemplate = useCallback(async (templateId: string) => {
    setSelectedTemplateId(templateId);
    setError(null);
    
    let templateData: DocumentTemplate;
    
    try {
      const response = await fetch(`/api/template-by-id?id=${templateId}`);
      if (!response.ok) throw new Error('Failed to load template');
      
      templateData = await response.json();
    } catch (err) {
      // Fallback to embedded template for development
      console.warn('Using fallback template (API not available)');
      if (templateId === 'legal_memo') {
        templateData = FALLBACK_TEMPLATE_MEMO;
      } else {
        // For other templates, use memo as base with different name
        templateData = { ...FALLBACK_TEMPLATE_MEMO, id: templateId, name: templateId };
      }
    }
    
    setTemplate(templateData);
    
    // Initialize variables with defaults (use empty string for no default)
    const defaults: Record<string, string> = {};
    templateData.variables.forEach((v: VariableDefinition) => {
      if (v.default === 'today') {
        defaults[v.id] = new Date().toISOString().split('T')[0];
      } else if (v.default !== undefined && v.default !== null) {
        defaults[v.id] = String(v.default);
      } else {
        defaults[v.id] = ''; // Ensure empty string, not undefined
      }
    });
    setVariablesState(defaults);
    
    // Reset document state
    setSections([]);
    setDocument(null);
    setStatus('initializing');
    setProgress(0);
  }, []);

  // ==========================================================================
  // SET VARIABLES
  // ==========================================================================
  
  const setVariables = useCallback((newVariables: Record<string, string>) => {
    setVariablesState(newVariables);
  }, []);

  // ==========================================================================
  // START GENERATION
  // ==========================================================================
  
  const startGeneration = useCallback(async (instructions: string) => {
    if (!template) {
      setError('No template selected');
      return;
    }
    
    // Reset state
    setStatus('researching');
    setProgress(0);
    setError(null);
    setSections([]);
    setDocument(null);
    setProgressMessage('Starting document generation...');
    
    // Build request
    const request: DraftRequest = {
      documentType: template.id as any,
      userInstructions: instructions,
      variables,
      options: {
        citationStyle: 'california',
        includeTableOfAuthorities: true,
        maxLength: 'medium',
        tone: 'formal',
      },
    };
    
    try {
      // Use fetch for SSE
      const response = await fetch('/api/orchestrate-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        throw new Error(`Generation failed: ${response.status}`);
      }
      
      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('No response body');
      }
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleStreamEvent(data);
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Generation failed');
      setStatus('error');
    }
  }, [template, variables]);

  // ==========================================================================
  // HANDLE STREAM EVENTS
  // ==========================================================================
  
  /**
   * Map API progress phases to DocumentStatus values.
   * This normalizes the phase names from the backend to valid DocumentStatus enum values.
   */
  const mapPhaseToStatus = (phase: string): DocumentStatus => {
    const phaseMapping: Record<string, DocumentStatus> = {
      // Direct matches
      'initializing': 'initializing',
      'researching': 'researching',
      'drafting': 'drafting',
      'verifying_citations': 'verifying_citations',
      'final_verification': 'final_verification',
      'complete': 'complete',
      'error': 'error',
      // Alternate phase names from API
      'research': 'researching',
      'citations': 'verifying_citations',
      'verification': 'final_verification',
    };
    return phaseMapping[phase] || 'drafting'; // Default to drafting if unknown
  };
  
  const handleStreamEvent = useCallback((event: any) => {
    switch (event.type) {
      case 'progress':
        // Map API phase to valid DocumentStatus
        setStatus(mapPhaseToStatus(event.phase));
        setProgress(event.percentComplete || 0);
        setProgressMessage(event.message || '');
        if (event.currentSection) {
          setGeneratingSection(event.currentSection);
        }
        break;
        
      case 'section_complete':
        setSections((prev) => {
          const existing = prev.findIndex((s) => s.sectionId === event.sectionId);
          // Use event data with fallbacks for required GeneratedSection fields
          const newSection: GeneratedSection = {
            sectionId: event.sectionId,
            sectionName: event.sectionName,
            content: event.content,
            wordCount: event.wordCount || 0,
            citations: event.citations || [],  // Use from event if provided
            generatedAt: event.generatedAt || new Date().toISOString(),  // Use from event if provided
            revisionCount: event.revisionCount ?? 0,  // Use from event if provided (nullish coalescing)
          };
          
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = newSection;
            return updated;
          }
          return [...prev, newSection];
        });
        setGeneratingSection(null);
        break;
        
      case 'document_complete':
        setDocument(event.document);
        setStatus('complete');
        setProgress(100);
        setProgressMessage('Document generation complete');
        setGeneratingSection(null);
        break;
        
      case 'error':
        setError(event.error || event.message || 'Unknown error');
        setStatus('error');
        break;
    }
  }, []);

  // ==========================================================================
  // REVISE SECTION
  // ==========================================================================
  
  const reviseSection = useCallback(async (sectionId: string, instructions: string) => {
    const section = sections.find((s) => s.sectionId === sectionId);
    if (!section) {
      setError('Section not found');
      return;
    }
    
    setGeneratingSection(sectionId);
    setError(null);
    
    try {
      const response = await fetch('/api/revise-section', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: document?.id,
          sectionId,
          sectionName: section.sectionName,
          revisionInstructions: instructions,
          currentContent: section.content,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Revision failed');
      }
      
      const result = await response.json();
      
      // Update section
      setSections((prev) =>
        prev.map((s) =>
          s.sectionId === sectionId
            ? {
                ...s,
                content: result.revisedContent,
                wordCount: result.wordCount,
                revisedAt: new Date().toISOString(),
                revisionCount: s.revisionCount + 1,
              }
            : s
        )
      );
      
      setSelectedSection(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revision failed');
    } finally {
      setGeneratingSection(null);
    }
  }, [sections, document]);

  // ==========================================================================
  // SELECT SECTION
  // ==========================================================================
  
  const selectSection = useCallback((sectionId: string | null) => {
    setSelectedSection(sectionId);
  }, []);

  // ==========================================================================
  // EXPORT DOCUMENT
  // ==========================================================================
  
  const exportDocument = useCallback(async (format: 'html' | 'pdf') => {
    if (!document) {
      setError('No document to export');
      return;
    }
    
    try {
      const response = await fetch('/api/export-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document,
          format,
          formatting: {
            includeTableOfAuthorities: true,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      if (format === 'html') {
        const html = await response.text();
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement('a');
        a.href = url;
        a.download = `${document.templateId}_${Date.now()}.html`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // For PDF, open in new window for printing
        const html = await response.text();
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.print();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  }, [document]);

  // ==========================================================================
  // RESET
  // ==========================================================================
  
  const reset = useCallback(() => {
    setSelectedTemplateId(null);
    setTemplate(null);
    setVariablesState({});
    setDocument(null);
    setSections([]);
    setStatus('initializing');
    setProgress(0);
    setProgressMessage('');
    setError(null);
    setSelectedSection(null);
    setGeneratingSection(null);
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  return {
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
  };
}

export default useDrafting;
