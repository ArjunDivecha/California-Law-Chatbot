/**
 * OrchestrationModal Component
 * 
 * A modal overlay that shows the multi-agent document generation pipeline
 * with animated progress visualization. Appears during document generation
 * and auto-closes when complete.
 */

import React, { useState, useEffect } from 'react';
import { DocumentStatus, GeneratedSection } from '../../types';

interface OrchestrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  progress: number;
  progressMessage: string;
  currentPhase: DocumentStatus;
  currentSection?: string;
  sections: GeneratedSection[];
  verificationScore?: number;
  autoCloseOnComplete?: boolean;
}

interface AgentTask {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed';
}

interface Agent {
  id: string;
  name: string;
  model: string;
  icon: string;
  color: string;
  status: 'pending' | 'active' | 'completed';
  statusText: string;
  tasks: AgentTask[];
}

export const OrchestrationModal: React.FC<OrchestrationModalProps> = ({
  isOpen,
  onClose,
  progress,
  progressMessage,
  currentPhase,
  currentSection,
  sections,
  verificationScore,
  autoCloseOnComplete = false,
}) => {
  const [activityLog, setActivityLog] = useState<Array<{ message: string; type: string; time: Date }>>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  // Add activity log entries when progress changes
  useEffect(() => {
    if (progressMessage && progressMessage !== 'Ready to generate...') {
      setActivityLog(prev => [...prev, {
        message: progressMessage,
        type: currentPhase,
        time: new Date()
      }].slice(-20)); // Keep last 20 entries
    }
  }, [progressMessage, currentPhase]);

  // Auto-close on complete if enabled
  useEffect(() => {
    if (autoCloseOnComplete && currentPhase === 'complete') {
      const timer = setTimeout(() => onClose(), 2000);
      return () => clearTimeout(timer);
    }
  }, [currentPhase, autoCloseOnComplete, onClose]);

  // Clear log when modal opens
  useEffect(() => {
    if (isOpen) {
      setActivityLog([{ message: 'Starting multi-agent document generation...', type: 'system', time: new Date() }]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Build agent data based on current phase
  const getAgents = (): Agent[] => {
    const phaseOrder = ['researching', 'drafting', 'verifying_citations', 'final_verification', 'complete'];
    const currentPhaseIndex = phaseOrder.indexOf(currentPhase);

    return [
      {
        id: 'research',
        name: 'Research Agent',
        model: 'Claude Haiku',
        icon: '🔍',
        color: '#2563eb',
        status: currentPhaseIndex > 0 ? 'completed' : currentPhase === 'researching' ? 'active' : 'pending',
        statusText: currentPhaseIndex > 0 ? 'Research Complete ✓' : currentPhase === 'researching' ? 'Searching...' : 'Waiting...',
        tasks: [
          { id: 'ceb', label: 'Search CEB Practice Guides', status: currentPhaseIndex > 0 ? 'completed' : currentPhase === 'researching' && progress < 15 ? 'active' : 'pending' },
          { id: 'cases', label: 'Find California Case Law', status: currentPhaseIndex > 0 ? 'completed' : currentPhase === 'researching' && progress >= 15 && progress < 20 ? 'active' : progress >= 15 ? 'completed' : 'pending' },
          { id: 'statutes', label: 'Lookup Relevant Statutes', status: currentPhaseIndex > 0 ? 'completed' : currentPhase === 'researching' && progress >= 20 ? 'active' : progress >= 25 ? 'completed' : 'pending' },
        ],
      },
      {
        id: 'drafter',
        name: 'Drafter Agent',
        model: 'Gemini 2.5 Flash',
        icon: '✍️',
        color: '#7c3aed',
        status: currentPhaseIndex > 1 ? 'completed' : currentPhase === 'drafting' ? 'active' : 'pending',
        statusText: currentPhaseIndex > 1 ? 'Drafting Complete ✓' : currentPhase === 'drafting' ? `Drafting: ${currentSection || '...'}` : 'Waiting...',
        tasks: sections.map(s => ({
          id: s.sectionId,
          label: s.sectionName,
          status: 'completed' as const,
        })),
      },
      {
        id: 'citation',
        name: 'Citation Agent',
        model: 'Pattern Matching',
        icon: '📚',
        color: '#db2777',
        status: currentPhaseIndex > 2 ? 'completed' : currentPhase === 'verifying_citations' ? 'active' : 'pending',
        statusText: currentPhaseIndex > 2 ? 'Citations Verified ✓' : currentPhase === 'verifying_citations' ? 'Processing...' : 'Waiting...',
        tasks: [
          { id: 'extract', label: 'Extract Citations', status: currentPhaseIndex > 2 ? 'completed' : currentPhase === 'verifying_citations' && progress < 80 ? 'active' : 'pending' },
          { id: 'verify', label: 'Verify Authorities', status: currentPhaseIndex > 2 ? 'completed' : currentPhase === 'verifying_citations' && progress >= 80 && progress < 85 ? 'active' : progress >= 80 ? 'completed' : 'pending' },
          { id: 'toa', label: 'Build Table of Authorities', status: currentPhaseIndex > 2 ? 'completed' : progress >= 85 ? 'completed' : 'pending' },
        ],
      },
      {
        id: 'verifier',
        name: 'Verifier Agent',
        model: 'Claude Sonnet',
        icon: '✅',
        color: '#059669',
        status: currentPhase === 'complete' ? 'completed' : currentPhase === 'final_verification' ? 'active' : 'pending',
        statusText: currentPhase === 'complete' ? 'Verification Complete ✓' : currentPhase === 'final_verification' ? 'Verifying...' : 'Waiting...',
        tasks: [
          { id: 'accuracy', label: 'Check Citation Accuracy', status: currentPhase === 'complete' ? 'completed' : currentPhase === 'final_verification' && progress < 92 ? 'active' : 'pending' },
          { id: 'consistency', label: 'Verify Consistency', status: currentPhase === 'complete' ? 'completed' : currentPhase === 'final_verification' && progress >= 92 && progress < 96 ? 'active' : progress >= 92 ? 'completed' : 'pending' },
          { id: 'compliance', label: 'California Compliance', status: currentPhase === 'complete' ? 'completed' : progress >= 96 ? 'completed' : 'pending' },
        ],
      },
    ];
  };

  const agents = getAgents();

  const getAgentCardStyle = (agent: Agent): React.CSSProperties => ({
    ...styles.agentCard,
    borderColor: agent.status === 'active' ? agent.color : agent.status === 'completed' ? '#10b981' : '#e2e8f0',
    backgroundColor: agent.status === 'completed' ? '#f0fdf4' : agent.status === 'pending' ? '#f8fafc' : 'white',
    opacity: agent.status === 'pending' ? 0.6 : 1,
    boxShadow: agent.status === 'active' ? `0 0 30px ${agent.color}30` : undefined,
    transform: agent.status === 'active' ? 'translateY(-4px) scale(1.02)' : undefined,
  });

  const getTaskIconStyle = (task: AgentTask, color: string): React.CSSProperties => ({
    ...styles.taskIcon,
    backgroundColor: task.status === 'completed' ? '#dcfce7' : task.status === 'active' ? `${color}20` : '#f1f5f9',
    color: task.status === 'completed' ? '#059669' : task.status === 'active' ? color : '#94a3b8',
  });

  const getLogColor = (type: string): string => {
    switch (type) {
      case 'researching': return '#2563eb';
      case 'drafting': return '#7c3aed';
      case 'verifying_citations': return '#db2777';
      case 'final_verification': return '#059669';
      default: return '#d97706';
    }
  };

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        {/* Close button */}
        <button style={styles.closeButton} onClick={onClose}>✕</button>

        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>🏛️ Legal Document Orchestration</h2>
          <p style={styles.subtitle}>Multi-Agent AI Document Generation Pipeline</p>
        </div>

        {/* Agent Pipeline */}
        <div style={styles.pipeline}>
          {agents.map(agent => (
            <div key={agent.id} style={getAgentCardStyle(agent)}>
              <div style={{ ...styles.agentIcon, backgroundColor: `${agent.color}15` }}>
                {agent.status === 'active' ? (
                  <span style={{ animation: 'pulse 1s infinite' }}>{agent.icon}</span>
                ) : agent.icon}
              </div>
              <div style={styles.agentName}>{agent.name}</div>
              <div style={styles.agentModel}>{agent.model}</div>
              <div style={{
                ...styles.agentStatus,
                backgroundColor: agent.status === 'active' ? `${agent.color}15` : agent.status === 'completed' ? '#dcfce7' : '#f1f5f9',
                color: agent.status === 'active' ? agent.color : agent.status === 'completed' ? '#059669' : '#64748b',
              }}>
                {agent.statusText}
              </div>
              <div style={styles.taskList}>
                {agent.tasks.slice(0, 3).map(task => (
                  <div key={task.id} style={styles.taskItem}>
                    <div style={getTaskIconStyle(task, agent.color)}>
                      {task.status === 'completed' ? '✓' : task.status === 'active' ? '●' : '○'}
                    </div>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{task.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div style={styles.progressSection}>
          <div style={styles.progressHeader}>
            <span style={styles.progressLabel}>📊 Overall Progress</span>
            <span style={styles.progressPercent}>{Math.round(progress)}%</span>
          </div>
          <div style={styles.progressBarContainer}>
            <div style={{ ...styles.progressBar, width: `${progress}%` }} />
          </div>
          <div style={styles.progressMessage}>{progressMessage}</div>
        </div>

        {/* Two-column layout: Activity Log + Section Preview */}
        <div style={styles.bottomSection}>
          {/* Activity Log */}
          <div style={styles.activityLog}>
            <div style={styles.logHeader}>
              <span>📡 Live Activity Feed</span>
              {currentPhase !== 'complete' && currentPhase !== 'idle' && (
                <span style={styles.liveIndicator}>
                  <span style={styles.liveDot} /> LIVE
                </span>
              )}
            </div>
            <div style={styles.logContent}>
              {activityLog.map((entry, i) => (
                <div key={i} style={{ ...styles.logLine, color: getLogColor(entry.type) }}>
                  [{entry.time.toLocaleTimeString()}] {entry.message}
                </div>
              ))}
            </div>
          </div>

          {/* Section Preview */}
          {sections.length > 0 && (
            <div style={styles.sectionPreview}>
              <div style={styles.sectionHeader}>📄 Generated Sections</div>
              <div style={styles.sectionTabs}>
                {sections.map(s => (
                  <button
                    key={s.sectionId}
                    onClick={() => setSelectedSectionId(s.sectionId)}
                    style={{
                      ...styles.sectionTab,
                      backgroundColor: selectedSectionId === s.sectionId ? '#ede9fe' : '#f1f5f9',
                      borderColor: selectedSectionId === s.sectionId ? '#7c3aed' : '#e2e8f0',
                      color: selectedSectionId === s.sectionId ? '#7c3aed' : '#64748b',
                    }}
                  >
                    {s.sectionName}
                  </button>
                ))}
              </div>
              <div style={styles.sectionContent}>
                {selectedSectionId
                  ? sections.find(s => s.sectionId === selectedSectionId)?.content || 'Loading...'
                  : sections[sections.length - 1]?.content || 'Sections will appear here as they are generated...'}
              </div>
            </div>
          )}
        </div>

        {/* Complete State */}
        {currentPhase === 'complete' && (
          <div style={styles.completeSection}>
            <div style={styles.completeIcon}>🎉</div>
            <div style={styles.completeTitle}>Document Generation Complete!</div>
            <div style={styles.completeStats}>
              <span>Verification Score: <strong>{verificationScore || 0}/100</strong></span>
              <span>Sections: <strong>{sections.length}</strong></span>
            </div>
            <button style={styles.viewDocumentButton} onClick={onClose}>
              📄 View Document
            </button>
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    backgroundColor: '#f8fafc',
    borderRadius: '20px',
    width: '95%',
    maxWidth: '1200px',
    maxHeight: '90vh',
    overflow: 'auto',
    padding: '30px',
    position: 'relative',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  closeButton: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#f1f5f9',
    color: '#64748b',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #2563eb, #7c3aed, #db2777)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748b',
  },
  pipeline: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    marginBottom: '30px',
  },
  agentCard: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '20px',
    border: '2px solid #e2e8f0',
    transition: 'all 0.3s ease',
  },
  agentIcon: {
    width: '50px',
    height: '50px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    margin: '0 auto 12px',
  },
  agentName: {
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: 600,
    color: '#1e293b',
    marginBottom: '4px',
  },
  agentModel: {
    textAlign: 'center',
    fontSize: '11px',
    color: '#94a3b8',
    marginBottom: '12px',
  },
  agentStatus: {
    textAlign: 'center',
    padding: '6px 12px',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: 500,
    marginBottom: '12px',
  },
  taskList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  taskItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  taskIcon: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    flexShrink: 0,
  },
  progressSection: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '20px',
    border: '1px solid #e2e8f0',
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  progressLabel: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1e293b',
  },
  progressPercent: {
    fontSize: '24px',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  progressBarContainer: {
    height: '10px',
    backgroundColor: '#e2e8f0',
    borderRadius: '10px',
    overflow: 'hidden',
    marginBottom: '10px',
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #2563eb, #7c3aed, #db2777, #059669)',
    borderRadius: '10px',
    transition: 'width 0.3s ease',
  },
  progressMessage: {
    fontSize: '13px',
    color: '#64748b',
  },
  bottomSection: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  activityLog: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '16px',
    border: '1px solid #e2e8f0',
  },
  logHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#1e293b',
  },
  liveIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    backgroundColor: '#fef2f2',
    borderRadius: '12px',
    fontSize: '11px',
    color: '#ef4444',
  },
  liveDot: {
    width: '6px',
    height: '6px',
    backgroundColor: '#ef4444',
    borderRadius: '50%',
    animation: 'pulse 1s infinite',
  },
  logContent: {
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    fontSize: '12px',
    lineHeight: 1.6,
    maxHeight: '150px',
    overflowY: 'auto',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    padding: '12px',
    border: '1px solid #e2e8f0',
  },
  logLine: {
    marginBottom: '4px',
  },
  sectionPreview: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '16px',
    border: '1px solid #e2e8f0',
  },
  sectionHeader: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1e293b',
    marginBottom: '12px',
  },
  sectionTabs: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '12px',
  },
  sectionTab: {
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    border: '1px solid #e2e8f0',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  sectionContent: {
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '13px',
    lineHeight: 1.6,
    maxHeight: '120px',
    overflowY: 'auto',
    color: '#334155',
    border: '1px solid #e2e8f0',
    whiteSpace: 'pre-wrap',
  },
  completeSection: {
    textAlign: 'center',
    padding: '30px',
    backgroundColor: '#f0fdf4',
    borderRadius: '16px',
    marginTop: '20px',
    border: '2px solid #86efac',
  },
  completeIcon: {
    fontSize: '48px',
    marginBottom: '12px',
  },
  completeTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#059669',
    marginBottom: '12px',
  },
  completeStats: {
    display: 'flex',
    gap: '24px',
    justifyContent: 'center',
    fontSize: '14px',
    color: '#64748b',
    marginBottom: '20px',
  },
  viewDocumentButton: {
    padding: '12px 32px',
    fontSize: '15px',
    fontWeight: 600,
    color: 'white',
    backgroundColor: '#059669',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
};

export default OrchestrationModal;
