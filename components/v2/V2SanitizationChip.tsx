/**
 * Reusable sanitization-preview chip ("privacy shield"). Drop below any
 * free-text input to show what the GLiNER preview detected. Shared by /v2
 * chat, /v2/draft, /v2/magic, /v2/verify so all pages give the attorney the
 * same on-screen visibility into what's being tokenized.
 *
 * Phase C.2 follow-up 2026-05-15. Uses the same hook
 * (useV2SanitizationPreview) which now calls GLiNER — see the hook
 * comment for parity discussion.
 *
 * 2026-08 DancingElephant rebrand: presentation only — amber "N items
 * protected on this device" pill with a shield icon + chevron that expands
 * to TOKEN ← original rows, teal empty state, neutral computing state. The
 * public props/callbacks are unchanged (this component is shared).
 *
 * INPUT FILES: none. OUTPUT FILES: none.
 */

import React, { useState } from 'react';
import { Shield, ShieldCheck, ChevronDown, X } from 'lucide-react';
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
  emptyLabel = 'Nothing to protect in this message',
  compact = false,
}) => {
  const { preview, isComputing, hasDetections } = useV2SanitizationPreview(text);
  // Non-compact keeps the previous always-visible token rows; compact starts
  // collapsed and the chevron reveals them.
  const [expanded, setExpanded] = useState(!compact);

  if (!text || text.length === 0) return null;

  const padClass = compact ? 'px-2.5 py-1' : 'px-3 py-1.5';
  const textClass = compact ? 'text-[11px]' : 'text-xs';

  if (isComputing && !hasDetections) {
    return (
      <div
        className={`inline-flex items-center gap-2 rounded-full border border-surface-pillline bg-surface-pill ${padClass} ${textClass} font-semibold text-ink-muted`}
      >
        <span className="de-spinner" aria-hidden />
        <span>Checking for privileged content…</span>
      </div>
    );
  }

  if (!hasDetections) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border border-deteal-line bg-deteal-bg ${padClass} ${textClass} font-semibold text-deteal-text`}
      >
        <ShieldCheck size={13} strokeWidth={1.8} aria-hidden />
        <span>{emptyLabel}</span>
      </div>
    );
  }

  const count = preview.tokens.length;
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        title="What was found on this device — nothing here has left this computer"
        className={`inline-flex w-fit items-center gap-1.5 rounded-full border border-deamber-line bg-deamber-bg ${padClass} ${textClass} font-semibold text-deamber-text transition hover:bg-deamber-bg2`}
      >
        <Shield size={13} strokeWidth={1.8} aria-hidden />
        <span>
          {count} item{count === 1 ? '' : 's'} protected on this device
        </span>
        <ChevronDown
          size={11}
          strokeWidth={2}
          aria-hidden
          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && <SpanList preview={preview} />}
    </div>
  );
};

const SpanList: React.FC<{ preview: PreviewData }> = ({ preview }) => {
  if (preview.tokens.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5 text-[11px] text-ink-secondary">
        {preview.tokens.map((t) => (
          <span
            key={t.value}
            className="inline-flex items-center gap-1.5 rounded-[7px] border border-surface-line bg-surface-app px-2 py-0.5"
            title={`${t.category}: "${t.raw}" → ${t.value}`}
          >
            <code className="font-mono text-deamber-text">{t.value}</code>
            <span className="text-[#C6BED2]">←</span>
            <span className="max-w-[180px] truncate text-ink-secondary">{t.raw}</span>
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
              className="ml-0.5 -mr-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[#C6BED2] hover:bg-deamber-line hover:text-deamber-text"
            >
              <X size={10} strokeWidth={2.4} aria-hidden />
            </button>
          </span>
        ))}
      </div>
      <span className="text-[10px] text-ink-faint">
        Not actually privileged? Remove a term to mark it safe to send as-is (saved on this device).
      </span>
    </div>
  );
};
