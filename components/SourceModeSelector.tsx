import React from 'react';

export type SourceMode = 'ceb-only' | 'ai-only' | 'hybrid';
export type PracticeArea = '' | 'lgbt_family' | 'trusts_estates' | 'family_law' | 'business';

interface SourceModeSelectorProps {
  mode: SourceMode;
  onModeChange: (mode: SourceMode) => void;
  practiceArea?: PracticeArea;
  onPracticeAreaChange?: (area: PracticeArea) => void;
  disabled?: boolean;
}

const PRACTICE_AREAS: Array<{ value: PracticeArea; label: string; description: string }> = [
  { value: '', label: 'All Practice Areas', description: 'Search across all CEB verticals' },
  { value: 'lgbt_family', label: 'LGBT Family Law', description: 'Same-sex couples, parentage, domestic partnerships' },
  { value: 'family_law', label: 'Family Law', description: 'Divorce, custody, support, marital property' },
  { value: 'trusts_estates', label: 'Trusts & Estates', description: 'Trusts, wills, probate, estate planning' },
  { value: 'business', label: 'Business Law', description: 'Contracts, litigation, corporate matters' },
];

export const SourceModeSelector: React.FC<SourceModeSelectorProps> = ({
  mode,
  onModeChange,
  practiceArea = '',
  onPracticeAreaChange,
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

      {/* Practice Area Filter - Optional */}
      {onPracticeAreaChange && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid #dee2e6', paddingTop: '1rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap'
          }}>
            <label style={{
              fontWeight: 600,
              fontSize: '0.9rem',
              color: '#495057',
              margin: 0,
              whiteSpace: 'nowrap'
            }}>
              Practice Area:
            </label>
            <select
              value={practiceArea}
              onChange={(e) => onPracticeAreaChange(e.target.value as PracticeArea)}
              disabled={disabled}
              style={{
                flex: 1,
                minWidth: '200px',
                padding: '0.5rem 0.75rem',
                border: '1px solid #ced4da',
                borderRadius: '6px',
                backgroundColor: 'white',
                color: '#495057',
                fontSize: '0.9rem',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1
              }}
            >
              {PRACTICE_AREAS.map(area => (
                <option key={area.value} value={area.value}>
                  {area.label}
                </option>
              ))}
            </select>
          </div>
          {practiceArea && (
            <div style={{
              marginTop: '0.5rem',
              fontSize: '0.8rem',
              color: '#6c757d',
              fontStyle: 'italic'
            }}>
              {PRACTICE_AREAS.find(a => a.value === practiceArea)?.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

