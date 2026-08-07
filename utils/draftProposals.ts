/**
 * utils/draftProposals.ts
 *
 * Parsing for the V2 Draft page's propose-changes flow: the model replies
 * with {"changes":[{section,description,rationale,find,replace}…]} and these
 * helpers turn that reply into proposal objects.
 *
 *   parseChangesJson — strict parse of a complete reply (handles ```json
 *     fences and incidental prose around the object).
 *   salvageChanges   — recovery parse for a TRUNCATED reply (stop_reason
 *     max_tokens cuts the JSON mid-object): scans the changes array and
 *     JSON.parses each balanced {...} chunk individually, string/escape
 *     aware, so every fully-emitted proposal survives a garbage tail.
 *
 * Extracted from components/v2/V2DraftPage.tsx so the truncation-recovery
 * behavior is unit-testable (tests/unverified-citation-visibility.test.mjs
 * covers the sibling visibility fixes; tests/draft-proposal-parsing.test.mjs
 * covers these).
 *
 * No file I/O.
 */

export interface ProposedChange {
  section: string;
  description: string;
  rationale: string;
  find: string;
  replace: string;
}

function toChange(c: Record<string, unknown>): ProposedChange {
  return {
    section: String(c.section ?? 'Change'),
    description: String(c.description ?? ''),
    rationale: String(c.rationale ?? ''),
    find: String(c.find ?? ''),
    replace: String(c.replace ?? ''),
  };
}

export function parseChangesJson(text: string): ProposedChange[] | null {
  if (!text) return null;
  let body = text.trim();
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) body = fence[1].trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(body.slice(start, end + 1));
    if (!obj || !Array.isArray(obj.changes)) return null;
    return obj.changes
      .filter((c: unknown) => c && typeof c === 'object')
      .map((c: unknown) => toChange(c as Record<string, unknown>));
  } catch {
    return null;
  }
}

export function salvageChanges(text: string): ProposedChange[] {
  const out: ProposedChange[] = [];
  if (!text) return out;
  const arrStart = text.indexOf('"changes"');
  if (arrStart === -1) return out;
  const bracket = text.indexOf('[', arrStart);
  if (bracket === -1) return out;
  let i = bracket + 1;
  while (i < text.length) {
    const objStart = text.indexOf('{', i);
    if (objStart === -1) break;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let objEnd = -1;
    for (let j = objStart; j < text.length; j += 1) {
      const ch = text[j];
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = !inString;
      } else if (!inString && ch === '{') {
        depth += 1;
      } else if (!inString && ch === '}') {
        depth -= 1;
        if (depth === 0) {
          objEnd = j;
          break;
        }
      }
    }
    if (objEnd === -1) break; // truncated mid-object — stop here
    try {
      const c = JSON.parse(text.slice(objStart, objEnd + 1));
      // A proposal without a non-empty "find" cannot be applied — drop it.
      if (c && typeof c === 'object' && typeof c.find === 'string' && c.find) {
        out.push(toChange(c));
      }
    } catch {
      break;
    }
    i = objEnd + 1;
  }
  return out;
}
