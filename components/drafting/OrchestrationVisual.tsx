/**
 * OrchestrationVisual.tsx
 * 
 * Beautiful animated visualization of the multi-agent document generation pipeline.
 * Shows real-time progress through Research → Drafting → Citation → Verification phases.
 */

import React, { useState, useEffect, useRef } from 'react';

// Types
interface AgentState {
  id: string;
  name: string;
  model: string;
  icon: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  statusText: string;
  tasks: TaskState[];
  color: string;
}

interface TaskState {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed';
}

interface OutputLine {
  id: string;
  timestamp: string;
  message: string;
  type: 'system' | 'research' | 'draft' | 'citation' | 'verify' | 'error';
}

interface SectionData {
  sectionId: string;
  sectionName: string;
  content: string;
  wordCount: number;
  citations: string[];
}

interface OrchestrationVisualProps {
  isGenerating: boolean;
  progress: number;
  progressMessage: string;
  currentPhase: string;
  currentSection?: string;
  sections: SectionData[];
  verificationScore?: number;
  onStartGeneration?: () => void;
}

// Styles as CSS-in-JS
const styles = {
  container: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    borderRadius: '20px',
    padding: '30px',
    color: '#e2e8f0',
  } as React.CSSProperties,
  
  title: {
    textAlign: 'center' as const,
    fontSize: '1.8rem',
    fontWeight: 700,
    marginBottom: '8px',
    background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #f472b6 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  } as React.CSSProperties,
  
  subtitle: {
    textAlign: 'center' as const,
    color: '#94a3b8',
    marginBottom: '30px',
    fontSize: '0.95rem',
  } as React.CSSProperties,
  
  pipeline: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '15px',
    marginBottom: '25px',
  } as React.CSSProperties,
  
  agentCard: {
    background: 'rgba(30, 41, 59, 0.8)',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid rgba(148, 163, 184, 0.1)',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
    minHeight: '220px',
  } as React.CSSProperties,
  
  agentIcon: {
    width: '50px',
    height: '50px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    margin: '0 auto 12px',
  } as React.CSSProperties,
  
  agentName: {
    textAlign: 'center' as const,
    fontSize: '1rem',
    fontWeight: 600,
    marginBottom: '4px',
    color: '#f1f5f9',
  } as React.CSSProperties,
  
  agentModel: {
    textAlign: 'center' as const,
    fontSize: '0.7rem',
    color: '#64748b',
    marginBottom: '10px',
  } as React.CSSProperties,
  
  agentStatus: {
    textAlign: 'center' as const,
    padding: '6px 12px',
    borderRadius: '16px',
    fontSize: '0.75rem',
    fontWeight: 500,
    background: 'rgba(0,0,0,0.2)',
    marginBottom: '12px',
  } as React.CSSProperties,
  
  taskList: {
    marginTop: '10px',
  } as React.CSSProperties,
  
  taskItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 0',
    fontSize: '0.75rem',
    color: '#94a3b8',
    borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
  } as React.CSSProperties,
  
  taskIcon: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    flexShrink: 0,
  } as React.CSSProperties,
  
  progressSection: {
    background: 'rgba(30, 41, 59, 0.6)',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '20px',
  } as React.CSSProperties,
  
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
  } as React.CSSProperties,
  
  progressTitle: {
    fontSize: '1rem',
    fontWeight: 600,
  } as React.CSSProperties,
  
  progressPercent: {
    fontSize: '1.5rem',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  } as React.CSSProperties,
  
  progressBarContainer: {
    height: '10px',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '10px',
  } as React.CSSProperties,
  
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #10b981)',
    borderRadius: '8px',
    transition: 'width 0.5s ease',
  } as React.CSSProperties,
  
  progressMessage: {
    color: '#94a3b8',
    fontSize: '0.85rem',
  } as React.CSSProperties,
  
  outputSection: {
    background: 'rgba(15, 23, 42, 0.8)',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '20px',
  } as React.CSSProperties,
  
  outputHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '15px',
  } as React.CSSProperties,
  
  outputTitle: {
    fontSize: '0.95rem',
    fontWeight: 600,
  } as React.CSSProperties,
  
  liveIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '3px 10px',
    background: 'rgba(239, 68, 68, 0.2)',
    borderRadius: '16px',
    fontSize: '0.65rem',
    color: '#ef4444',
  } as React.CSSProperties,
  
  liveDot: {
    width: '6px',
    height: '6px',
    background: '#ef4444',
    borderRadius: '50%',
    animation: 'pulse 1s infinite',
  } as React.CSSProperties,
  
  outputContent: {
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    fontSize: '0.75rem',
    lineHeight: 1.5,
    maxHeight: '200px',
    overflowY: 'auto' as const,
    padding: '12px',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '10px',
  } as React.CSSProperties,
  
  sectionPreview: {
    background: 'rgba(30, 41, 59, 0.6)',
    borderRadius: '16px',
    padding: '20px',
  } as React.CSSProperties,
  
  sectionTabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '15px',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  
  sectionTab: {
    padding: '6px 12px',
    borderRadius: '6px',
    background: 'rgba(0,0,0,0.2)',
    color: '#94a3b8',
    fontSize: '0.75rem',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    border: '1px solid transparent',
  } as React.CSSProperties,
  
  sectionContent: {
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '10px',
    padding: '15px',
    maxHeight: '300px',
    overflowY: 'auto' as const,
    lineHeight: 1.6,
    fontSize: '0.85rem',
  } as React.CSSProperties,
};

// Agent configurations
const INITIAL_AGENTS: AgentState[] = [
  {
    id: 'research',
    name: 'Research Agent',
    model: 'Claude Haiku',
    icon: '🔍',
    status: 'pending',
    statusText: 'Waiting...',
    color: '#3b82f6',
    tasks: [
      { id: 'ceb', label: 'Search CEB Guides', status: 'pending' },
      { id: 'cases', label: 'Find Case Law', status: 'pending' },
      { id: 'statutes', label: 'Lookup Statutes', status: 'pending' },
    ],
  },
  {
    id: 'drafter',
    name: 'Drafter Agent',
    model: 'Gemini 2.5 Pro',
    icon: '✍️',
    status: 'pending',
    statusText: 'Waiting...',
    color: '#8b5cf6',
    tasks: [],
  },
  {
    id: 'citation',
    name: 'Citation Agent',
    model: 'Pattern Matching',
    icon: '📚',
    status: 'pending',
    statusText: 'Waiting...',
    color: '#ec4899',
    tasks: [
      { id: 'extract', label: 'Extract Citations', status: 'pending' },
      { id: 'verify', label: 'Verify Authorities', status: 'pending' },
      { id: 'toa', label: 'Build TOA', status: 'pending' },
    ],
  },
  {
    id: 'verifier',
    name: 'Verifier Agent',
    model: 'Claude Sonnet',
    icon: '✅',
    status: 'pending',
    statusText: 'Waiting...',
    color: '#10b981',
    tasks: [
      { id: 'accuracy', label: 'Check Accuracy', status: 'pending' },
      { id: 'consistency', label: 'Verify Consistency', status: 'pending' },
      { id: 'compliance', label: 'CA Compliance', status: 'pending' },
    ],
  },
];

export const OrchestrationVisual: React.FC<OrchestrationVisualProps> = ({
  isGenerating,
  progress,
  progressMessage,
  currentPhase,
  currentSection,
  sections,
  verificationScore,
  onStartGeneration,
}) => {
  const [agents, setAgents] = useState<AgentState[]>(INITIAL_AGENTS);
  const [outputLines, setOutputLines] = useState<OutputLine[]>([]);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Add output line
  const addOutput = (message: string, type: OutputLine['type']) => {
    const line: OutputLine = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      message,
      type,
    };
    setOutputLines(prev => [...prev.slice(-50), line]); // Keep last 50 lines
  };

  // Update agent state
  const updateAgent = (agentId: string, updates: Partial<AgentState>) => {
    setAgents(prev => prev.map(a => 
      a.id === agentId ? { ...a, ...updates } : a
    ));
  };

  // Update task state
  const updateTask = (agentId: string, taskId: string, status: TaskState['status']) => {
    setAgents(prev => prev.map(a => 
      a.id === agentId 
        ? { ...a, tasks: a.tasks.map(t => t.id === taskId ? { ...t, status } : t) }
        : a
    ));
  };

  // Handle phase changes
  useEffect(() => {
    switch (currentPhase) {
      case 'initializing':
        addOutput('📋 Initializing orchestration pipeline...', 'system');
        break;
        
      case 'researching':
        updateAgent('research', { status: 'active', statusText: progressMessage });
        addOutput(`🔍 ${progressMessage}`, 'research');
        
        if (progressMessage.includes('CEB')) {
          updateTask('research', 'ceb', 'active');
        } else if (progressMessage.includes('case law')) {
          updateTask('research', 'ceb', 'completed');
          updateTask('research', 'cases', 'active');
        } else if (progressMessage.includes('Ranking')) {
          updateTask('research', 'cases', 'completed');
          updateTask('research', 'statutes', 'active');
        } else if (progressMessage.includes('complete')) {
          updateTask('research', 'statutes', 'completed');
          updateAgent('research', { status: 'completed', statusText: 'Complete ✓' });
        }
        break;
        
      case 'drafting':
        updateAgent('drafter', { status: 'active', statusText: progressMessage });
        addOutput(`✍️ ${progressMessage}`, 'draft');
        break;
        
      case 'verifying_citations':
        updateAgent('drafter', { status: 'completed', statusText: 'Complete ✓' });
        updateAgent('citation', { status: 'active', statusText: progressMessage });
        addOutput(`📚 ${progressMessage}`, 'citation');
        
        if (progressMessage.includes('processed')) {
          updateTask('citation', 'extract', 'completed');
          updateTask('citation', 'verify', 'completed');
          updateTask('citation', 'toa', 'completed');
          updateAgent('citation', { status: 'completed', statusText: 'Complete ✓' });
        }
        break;
        
      case 'final_verification':
        updateAgent('verifier', { status: 'active', statusText: progressMessage });
        addOutput(`✅ ${progressMessage}`, 'verify');
        
        if (progressMessage.includes('complete')) {
          updateTask('verifier', 'accuracy', 'completed');
          updateTask('verifier', 'consistency', 'completed');
          updateTask('verifier', 'compliance', 'completed');
          updateAgent('verifier', { status: 'completed', statusText: 'Complete ✓' });
        }
        break;
        
      case 'complete':
        addOutput('🎉 Document generation complete!', 'system');
        break;
    }
  }, [currentPhase, progressMessage]);

  // Handle section completion
  useEffect(() => {
    if (sections.length > 0) {
      const latest = sections[sections.length - 1];
      addOutput(
        `📄 "${latest.sectionName}" complete (${latest.wordCount} words, ${latest.citations?.length || 0} citations)`,
        'draft'
      );
      setSelectedSection(latest.sectionId);
    }
  }, [sections.length]);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [outputLines]);

  // Reset agents when starting new generation
  useEffect(() => {
    if (isGenerating && progress === 0) {
      setAgents(INITIAL_AGENTS);
      setOutputLines([]);
      setSelectedSection(null);
    }
  }, [isGenerating, progress]);

  const getAgentCardStyle = (agent: AgentState): React.CSSProperties => {
    const base = { ...styles.agentCard };
    
    if (agent.status === 'active') {
      return {
        ...base,
        borderColor: agent.color,
        boxShadow: `0 0 30px ${agent.color}40`,
        transform: 'translateY(-3px)',
      };
    } else if (agent.status === 'completed') {
      return {
        ...base,
        borderColor: '#10b981',
        opacity: 0.8,
      };
    } else {
      return {
        ...base,
        opacity: 0.5,
      };
    }
  };

  const getTaskIconStyle = (task: TaskState, agentColor: string): React.CSSProperties => {
    const base = { ...styles.taskIcon };
    
    if (task.status === 'completed') {
      return { ...base, background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' };
    } else if (task.status === 'active') {
      return { ...base, background: `${agentColor}20`, color: agentColor };
    } else {
      return { ...base, background: 'rgba(148, 163, 184, 0.1)', color: '#475569' };
    }
  };

  const getOutputLineStyle = (type: OutputLine['type']): React.CSSProperties => {
    const colors: Record<string, string> = {
      system: '#fbbf24',
      research: '#60a5fa',
      draft: '#a78bfa',
      citation: '#f472b6',
      verify: '#34d399',
      error: '#ef4444',
    };
    return { color: colors[type], marginBottom: '6px' };
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🏛️ Legal Document Orchestration</h2>
      <p style={styles.subtitle}>Multi-Agent AI Document Generation Pipeline</p>

      {/* Agent Pipeline */}
      <div style={styles.pipeline}>
        {agents.map(agent => (
          <div key={agent.id} style={getAgentCardStyle(agent)}>
            <div style={{
              ...styles.agentIcon,
              background: `${agent.color}20`,
            }}>
              {agent.status === 'active' ? (
                <span style={{ animation: 'pulse 1s infinite' }}>{agent.icon}</span>
              ) : (
                agent.icon
              )}
            </div>
            <div style={styles.agentName}>{agent.name}</div>
            <div style={styles.agentModel}>{agent.model}</div>
            <div style={{
              ...styles.agentStatus,
              background: agent.status === 'active' ? `${agent.color}20` : 
                         agent.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : undefined,
              color: agent.status === 'active' ? agent.color :
                     agent.status === 'completed' ? '#10b981' : '#94a3b8',
            }}>
              {agent.statusText}
            </div>
            <div style={styles.taskList}>
              {agent.tasks.map(task => (
                <div key={task.id} style={styles.taskItem}>
                  <div style={getTaskIconStyle(task, agent.color)}>
                    {task.status === 'completed' ? '✓' : task.status === 'active' ? '●' : '○'}
                  </div>
                  <span>{task.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Progress Section */}
      <div style={styles.progressSection}>
        <div style={styles.progressHeader}>
          <div style={styles.progressTitle}>📊 Overall Progress</div>
          <div style={styles.progressPercent}>{progress}%</div>
        </div>
        <div style={styles.progressBarContainer}>
          <div style={{ ...styles.progressBar, width: `${progress}%` }} />
        </div>
        <div style={styles.progressMessage}>{progressMessage}</div>
      </div>

      {/* Live Output */}
      <div style={styles.outputSection}>
        <div style={styles.outputHeader}>
          <div style={styles.outputTitle}>📡 Live Activity Feed</div>
          {isGenerating && (
            <div style={styles.liveIndicator}>
              <div style={styles.liveDot} />
              LIVE
            </div>
          )}
        </div>
        <div style={styles.outputContent} ref={outputRef}>
          {outputLines.length === 0 ? (
            <div style={{ color: '#fbbf24' }}>Awaiting start...</div>
          ) : (
            outputLines.map(line => (
              <div key={line.id} style={getOutputLineStyle(line.type)}>
                [{line.timestamp}] {line.message}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Section Preview */}
      {sections.length > 0 && (
        <div style={styles.sectionPreview}>
          <h3 style={{ marginBottom: '15px', fontSize: '1rem' }}>📄 Generated Sections</h3>
          <div style={styles.sectionTabs}>
            {sections.map(section => (
              <div
                key={section.sectionId}
                style={{
                  ...styles.sectionTab,
                  background: selectedSection === section.sectionId 
                    ? 'rgba(139, 92, 246, 0.2)' 
                    : 'rgba(16, 185, 129, 0.15)',
                  color: selectedSection === section.sectionId ? '#a78bfa' : '#10b981',
                  borderColor: selectedSection === section.sectionId 
                    ? 'rgba(139, 92, 246, 0.3)' 
                    : 'rgba(16, 185, 129, 0.3)',
                }}
                onClick={() => setSelectedSection(section.sectionId)}
              >
                {section.sectionName}
              </div>
            ))}
          </div>
          {selectedSection && (
            <div style={styles.sectionContent}>
              {sections.find(s => s.sectionId === selectedSection)?.content
                .split('\n')
                .map((line, i) => (
                  <div key={i}>{line || <br />}</div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* CSS Keyframes via style tag */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
};

export default OrchestrationVisual;
