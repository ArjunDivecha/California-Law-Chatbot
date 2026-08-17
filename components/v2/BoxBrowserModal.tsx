/**
 * =============================================================================
 * BoxBrowserModal — shared Box folder browser (Draft page + Chat attachments).
 * =============================================================================
 * Navigate folders; pick a file (mode 'file') or choose the current folder as
 * a save destination (mode 'folder'). Metadata only flows here — file BYTES
 * are downloaded by the caller (downloadBoxFile) and enter the same on-device
 * extraction + PII-tokenization funnel as a local upload.
 *
 * No file I/O (network via boxClient only).
 */

import React, { useState } from 'react';
import { listBoxFolder, type BoxItem, type BoxListing } from '../../services/boxClient.ts';

export const LOADABLE_EXT = /\.(docx|doc|pdf|txt|md)$/i;

export const BoxBrowserModal: React.FC<{
  mode: 'file' | 'folder';
  getToken: () => Promise<string | null>;
  onPickFile: (item: BoxItem) => void;
  onPickFolder: (folderId: string) => void;
  onClose: () => void;
}> = ({ mode, getToken, onPickFile, onPickFolder, onClose }) => {
  const [trail, setTrail] = useState<Array<{ id: string; name: string }>>([{ id: '0', name: 'All files' }]);
  const [listing, setListing] = useState<BoxListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const current = trail[trail.length - 1];

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listBoxFolder(getToken, current.id)
      .then((l) => {
        if (!cancelled) setListing(l);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [current.id, getToken]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-8" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-5 py-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900">
              {mode === 'file' ? 'Load a document from Box' : 'Choose a Box folder to save into'}
            </h4>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-gray-100 hover:bg-gray-200 px-3 py-1.5 text-xs text-gray-700"
            >
              Cancel
            </button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-[12px] text-gray-600">
            {trail.map((t, i) => (
              <React.Fragment key={t.id}>
                {i > 0 && <span className="text-gray-400">/</span>}
                <button
                  type="button"
                  className={i === trail.length - 1 ? 'font-semibold text-gray-900' : 'hover:underline text-[#0061d5]'}
                  onClick={() => setTrail(trail.slice(0, i + 1))}
                >
                  {t.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading && <p className="px-3 py-2 text-xs text-gray-500">Loading…</p>}
          {error && <p className="px-3 py-2 text-xs text-red-600">{error}</p>}
          {!loading && !error && listing && listing.items.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-500">This folder is empty.</p>
          )}
          {!loading &&
            !error &&
            listing?.items.map((item) => {
              const loadable = item.type === 'file' && LOADABLE_EXT.test(item.name);
              const clickable = item.type === 'folder' || (mode === 'file' && loadable);
              return (
                <button
                  key={`${item.type}-${item.id}`}
                  type="button"
                  disabled={!clickable}
                  onClick={() => {
                    if (item.type === 'folder') setTrail([...trail, { id: item.id, name: item.name }]);
                    else if (mode === 'file' && loadable) onPickFile(item);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] ${
                    clickable ? 'hover:bg-gray-50 text-gray-900' : 'text-gray-400 cursor-default'
                  }`}
                >
                  <span>{item.type === 'folder' ? '📁' : '📄'}</span>
                  <span className="flex-1 truncate">{item.name}</span>
                  {item.type === 'file' && item.size !== undefined && (
                    <span className="shrink-0 text-[11px] text-gray-400">{Math.max(1, Math.round(item.size / 1024))} KB</span>
                  )}
                </button>
              );
            })}
        </div>
        {mode === 'folder' && (
          <div className="border-t border-gray-200 px-5 py-3 flex justify-end">
            <button
              type="button"
              onClick={() => onPickFolder(current.id)}
              className="rounded-full bg-[#0061d5] hover:bg-[#004fb0] px-4 py-2 text-xs font-semibold text-white"
            >
              Save into “{current.name}”
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

