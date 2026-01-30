/**
 * VariableInputPanel Component
 * 
 * Form for inputting document template variables.
 */

import React from 'react';
import type { VariableDefinition } from '../../types';

interface VariableInputPanelProps {
  variables: VariableDefinition[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  disabled?: boolean;
}

export const VariableInputPanel: React.FC<VariableInputPanelProps> = ({
  variables,
  values,
  onChange,
  disabled,
}) => {
  const handleChange = (id: string, value: string) => {
    onChange({ ...values, [id]: value });
  };

  const isComplete = variables
    .filter((v) => v.required)
    .every((v) => values[v.id] && values[v.id].trim() !== '');

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Document Details</h3>
      <p style={styles.subtitle}>Fill in the required fields to generate your document</p>
      
      <div style={styles.form}>
        {variables.map((variable) => (
          <div key={variable.id} style={styles.field}>
            <label style={styles.label}>
              {variable.name}
              {variable.required && <span style={styles.required}>*</span>}
            </label>
            
            {variable.type === 'text' && (
              <input
                type="text"
                value={values[variable.id] || ''}
                onChange={(e) => handleChange(variable.id, e.target.value)}
                placeholder={variable.placeholder}
                disabled={disabled}
                style={styles.input}
              />
            )}
            
            {variable.type === 'date' && (
              <input
                type="date"
                value={values[variable.id] || ''}
                onChange={(e) => handleChange(variable.id, e.target.value)}
                disabled={disabled}
                style={styles.input}
              />
            )}
            
            {variable.type === 'number' && (
              <input
                type="number"
                value={values[variable.id] || ''}
                onChange={(e) => handleChange(variable.id, e.target.value)}
                placeholder={variable.placeholder}
                disabled={disabled}
                style={styles.input}
              />
            )}
            
            {variable.type === 'textarea' && (
              <textarea
                value={values[variable.id] || ''}
                onChange={(e) => handleChange(variable.id, e.target.value)}
                placeholder={variable.placeholder}
                disabled={disabled}
                style={styles.textarea}
                rows={3}
              />
            )}
            
            {variable.type === 'select' && variable.options && (
              <select
                value={values[variable.id] || ''}
                onChange={(e) => handleChange(variable.id, e.target.value)}
                disabled={disabled}
                style={styles.select}
              >
                <option value="">Select...</option>
                {variable.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>
      
      {!isComplete && (
        <p style={styles.hint}>
          Fill in all required fields (*) to continue
        </p>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
    border: '1px solid #e5e7eb',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '20px',
  },
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#374151',
    marginBottom: '6px',
  },
  required: {
    color: '#ef4444',
    marginLeft: '4px',
  },
  input: {
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  textarea: {
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  select: {
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    outline: 'none',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
  },
  hint: {
    fontSize: '12px',
    color: '#9ca3af',
    marginTop: '16px',
    textAlign: 'center',
  },
};

export default VariableInputPanel;
