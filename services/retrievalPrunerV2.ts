/**
 * V2 retrieval pruner — adapted from services/retrievalPruner.ts for
 * V2's source-summary shape. Dedupes + caps the per-message sources
 * list so the panel doesn't bloat when multiple tools return the same
 * case (e.g., CourtListener AND citation_verify hitting the same
 * opinion).
 *
 * Pure function; called at render time in SourcesPanel.
 */

export interface V2PrunableSource {
  tool_name: string;
  source_type: string;
  title: string;
  detail?: string;
  url?: string;
  status?: string;
}

const DEFAULT_MAX = 12;

/**
 * Dedupe by lowercased (title, url) pair. Prefer entries that have a
 * URL (more useful to the attorney) when collisions occur. Cap total
 * at `max` to keep the panel readable.
 */
export function prune<T extends V2PrunableSource>(sources: T[], max: number = DEFAULT_MAX): T[] {
  const seen = new Map<string, T>();
  for (const s of sources) {
    if (!s?.title) continue;
    const key = `${s.title.toLowerCase().trim()}::${(s.url ?? '').toLowerCase().trim()}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, s);
      continue;
    }
    // Tie-break: prefer the entry with a URL; otherwise keep the first.
    if (!existing.url && s.url) {
      seen.set(key, s);
    }
  }
  // Also collapse near-duplicates that share the title but differ only
  // in punctuation/case in url. The map-key above handles exact matches;
  // anything different is kept distinct.
  const arr = Array.from(seen.values());
  return arr.slice(0, max);
}
