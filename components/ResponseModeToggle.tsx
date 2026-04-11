import React from 'react';
import type { ResponseMode } from '../types';

interface ResponseModeToggleProps {
  mode: ResponseMode;
  onModeChange: (mode: ResponseMode) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{
  value: ResponseMode;
  label: string;
}> = [
  {
    value: 'speed',
    label: 'Speed',
  },
  {
    value: 'accuracy',
    label: 'Accuracy',
  },
];

export const ResponseModeToggle: React.FC<ResponseModeToggleProps> = ({
  mode,
  onModeChange,
  disabled = false,
}) => {
  return (
    <fieldset className="rounded-lg border border-gray-200 bg-white/90 p-1 shadow-sm">
      <legend className="sr-only">Response Mode</legend>
      <div className="flex gap-1">
        {OPTIONS.map((option) => {
          const checked = mode === option.value;
          const activeClasses =
            option.value === 'accuracy'
              ? 'border-pink-500 bg-pink-500 text-white'
              : 'border-emerald-500 bg-emerald-500 text-white';

          return (
            <label
              key={option.value}
              className={`rounded-md border px-2.5 py-1.5 transition-colors ${
                checked
                  ? activeClasses
                  : 'border-transparent bg-white text-gray-600'
              } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              title={option.value === 'accuracy' ? 'Full retrieval and verification' : 'Direct Anthropic pass-through'}
            >
              <input
                type="radio"
                name="response-mode"
                value={option.value}
                checked={checked}
                disabled={disabled}
                onChange={() => onModeChange(option.value)}
                className="sr-only"
              />
              <div className="text-xs font-semibold leading-none">{option.label}</div>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};

export default ResponseModeToggle;
