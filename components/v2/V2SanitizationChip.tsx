/**
 * Reusable sanitization-preview chip. Drop below any free-text input
 * to show what the GLiNER preview detected. Shared by /v2 chat,
 * /v2/draft, /v2/magic, /v2/verify so all pages give the attorney the
 * same on-screen visibility into what's being tokenized.
 *
 * Phase C.2 follow-up 2026-05-15. Uses the same hook
 * (useV2SanitizationPreview) which now calls GLiNER — see the hook
 * comment for parity discussion.
 */

import React from 'react';
import { useV2SanitizationPreview, type PreviewData } from '../../hooks/useV2SanitizationPreview';
import { addToUserAllowlist } from '../../services/sanitization/userAllowlist.ts';

interface Props {
  /** The current input text. Pass empty string to hide. */
  text: string;
  /** Optional override for the "nothing detected" label. */
  emptyLabel?: string;
  /** Compact mode — smaller padding, intended for use under multiple
   * input fields on the same page. */
  compact?: boolean;
}

export const V2SanitizationChip: React.FC<Props> = ({
  text,
  emptyLabel = 'No privileged content detected',
  compact = false,
}) => {
  const { preview, isComputing, hasDetections } = useV2SanitizationPreview(text);

  if (!text || text.length === 0) return null;

  const padClass = compact ? 'px-2 py-1' : 'px-3 py-2';
  const textClass = compact ? 'text-[11px]' : 'text-xs';

  if (isComputing && !hasDetections) {
    return (
      <div className={`inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-200 ${padClass} ${textClass} text-gray-600`}>
        <span className="animate-spin">⟳</span>
        <span>Checking for privileged content…</span>
      </div>
    );
  }

  if (!hasDetections) {
    return (
      <div className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 ${padClass} ${textClass} text-emerald-800 font-semibold`}>
        <span>🌐</span>
        <span>{emptyLabel}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className={`inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 ${padClass} ${textClass} text-amber-900 font-semibold w-fit`}>
        <span>⚠️</span>
        <span>
          {preview.tokens.length} privileged span{preview.tokens.length === 1 ? '' : 's'} will be tokenized before send
        </span>
      </div>
      {!compact && (
        <SpanList preview={preview} />
      )}
    </div>
  );
};

const SpanList: React.FC<{ preview: PreviewData }> = ({ preview }) => {
  if (preview.tokens.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1.5 text-[11px] text-gray-700">
        {preview.tokens.map((t) => (
          <span
            key={t.value}
            className="inline-flex items-center gap-1 rounded-md bg-pink-50 border border-pink-200 px-1.5 py-0.5"
            title={`${t.category}: "${t.raw}" → ${t.value}`}
          >
            <code className="font-mono">{t.value}</code>
            <span className="text-pink-700">←</span>
            <span className="text-gray-800 truncate max-w-[180px]">{t.raw}</span>
            <button
              type="button"
              // Mark this term "not privileged" — adds it to the per-device
              // user allowlist. The send path (detectPii / tokenizeForWire) and
              // this preview both then skip it, so it goes over the wire as
              // plain text. The preview recomputes via the allowlist-changed
              // subscription, so the chip disappears immediately.
              onClick={() => addToUserAllowlist(t.raw)}
              title={`Not privileged — always send "${t.raw.slice(0, 40)}" as-is on this device`}
              aria-label={`Mark "${t.raw}" as not privileged`}
              className="ml-0.5 -mr-0.5 flex h-4 w-4 items-center justify-center rounded-full text-pink-700/60 hover:bg-pink-200 hover:text-pink-900"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <span className="text-[10px] text-gray-400">
        Not actually privileged? Click <span className="font-semibold">×</span> on a term to mark it
        safe to send as-is (saved on this device).
      </span>
    </div>
  );
};
