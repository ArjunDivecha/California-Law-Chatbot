import React from 'react';

export type SourceMode = 'ceb-only' | 'ai-only' | 'hybrid';

interface SourceModeSelectorProps {
  mode: SourceMode;
  onModeChange: (mode: SourceMode) => void;
  disabled?: boolean;
}

export const SourceModeSelector: React.FC<SourceModeSelectorProps> = ({ 
  mode, 
  onModeChange,
  disabled = false 
}) => {
  const getModeDescription = (selectedMode: SourceMode): string => {
    switch (selectedMode) {
      case 'ceb-only':
        return '📚 Authoritative CEB practice guides only (fastest, 3 verticals)';
      case 'hybrid':
        return '🔄 CEB + case law + legislation (recommended, most comprehensive)';
      case 'ai-only':
        return '🤖 Case law, legislation, and web search (no CEB)';
      default:
        return '';
    }
  };

  const getModeLabel = (selectedMode: SourceMode): string => {
    switch (selectedMode) {
      case 'ceb-only':
        return '📚 CEB Only';
      case 'hybrid':
        return '🔄 Hybrid';
      case 'ai-only':
        return '🤖 AI Only';
      default:
        return '';
    }
  };

  return (
    <div style={{
      padding: '1rem',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      marginBottom: '1rem',
      border: '1px solid #dee2e6'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '0.75rem',
        gap: '0.5rem'
      }}>
        <label style={{
          fontWeight: 600,
          fontSize: '0.9rem',
          color: '#495057',
          margin: 0
        }}>
          Source Mode:
        </label>
      </div>

      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '0.75rem'
      }}>
        <button
          onClick={() => onModeChange('ceb-only')}
          disabled={disabled}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            border: mode === 'ceb-only' ? '2px solid #0066cc' : '1px solid #ced4da',
            borderRadius: '6px',
            backgroundColor: mode === 'ceb-only' ? '#e7f3ff' : 'white',
            color: mode === 'ceb-only' ? '#0066cc' : '#495057',
            fontWeight: mode === 'ceb-only' ? 600 : 400,
            fontSize: '0.9rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: disabled ? 0.6 : 1
          }}
        >
          {getModeLabel('ceb-only')}
        </button>

        <button
          onClick={() => onModeChange('hybrid')}
          disabled={disabled}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            border: mode === 'hybrid' ? '2px solid #28a745' : '1px solid #ced4da',
            borderRadius: '6px',
            backgroundColor: mode === 'hybrid' ? '#e8f5e9' : 'white',
            color: mode === 'hybrid' ? '#28a745' : '#495057',
            fontWeight: mode === 'hybrid' ? 600 : 400,
            fontSize: '0.9rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: disabled ? 0.6 : 1
          }}
        >
          {getModeLabel('hybrid')}
        </button>

        <button
          onClick={() => onModeChange('ai-only')}
          disabled={disabled}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            border: mode === 'ai-only' ? '2px solid #6c757d' : '1px solid #ced4da',
            borderRadius: '6px',
            backgroundColor: mode === 'ai-only' ? '#f0f0f0' : 'white',
            color: mode === 'ai-only' ? '#6c757d' : '#495057',
            fontWeight: mode === 'ai-only' ? 600 : 400,
            fontSize: '0.9rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            opacity: disabled ? 0.6 : 1
          }}
        >
          {getModeLabel('ai-only')}
        </button>
      </div>

      <div style={{
        fontSize: '0.85rem',
        color: '#6c757d',
        lineHeight: '1.4',
        fontStyle: 'italic'
      }}>
        {getModeDescription(mode)}
      </div>
    </div>
  );
};

