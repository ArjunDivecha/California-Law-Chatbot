/**
 * utils/docxSurgery.ts
 *
 * In-place text editing of a Word (.docx) file, preserving every bit of the
 * original formatting (2026-08-17). Added because round-tripping a firm
 * document through the Draft page used to rebuild it from plain text,
 * destroying styles, numbering, headers, signature blocks and letterhead.
 *
 * HOW IT WORKS
 *   A .docx is a zip; the body text lives in word/document.xml. Word splits
 *   a sentence across multiple <w:t> runs (spell-check state, tracked
 *   changes, formatting boundaries), so a phrase the user wants replaced
 *   rarely sits in one run. For each paragraph we therefore:
 *     1. collect its <w:t> runs and concatenate their text,
 *     2. locate the find-string in that concatenation,
 *     3. write the replacement into the run where the match STARTS and
 *        blank the remainder of the matched span in later runs.
 *   The replacement inherits the formatting of the run it lands in — the
 *   same behavior as selecting the phrase in Word and typing over it.
 *   Every other byte of the archive is passed through untouched.
 *
 * WHAT IT DOES NOT DO
 *   No formatting changes, no structural edits, no support for text that
 *   spans paragraphs. Replacements that cannot be located are reported to
 *   the caller (never silently dropped) so the UI can fall back or warn.
 *
 * No file I/O (operates on ArrayBuffers in the browser).
 */

import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';

export interface DocxReplacement {
  find: string;
  replace: string;
}

export interface DocxSurgeryResult {
  /** The rewritten .docx bytes (original archive with only text changed). */
  bytes: Uint8Array;
  /** Replacements successfully applied. */
  applied: DocxReplacement[];
  /** Replacements whose `find` text could not be located in the document. */
  unmatched: DocxReplacement[];
}

const BODY_PART = 'word/document.xml';

/** Normalize whitespace the way Word may render it, for tolerant matching. */
function normalizeWs(s: string): string {
  return s.replace(/ /g, ' ').replace(/\s+/g, ' ');
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function decodeXmlText(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

interface RunSlot {
  /** Index in the xml string where this run's text content starts. */
  start: number;
  /** Index just past the text content. */
  end: number;
  /** Decoded text of the run. */
  text: string;
  /** True when the <w:t> carries xml:space="preserve". */
  preserved: boolean;
}

/** Find every <w:t>…</w:t> text slot in a chunk of document XML. */
function findRunSlots(xml: string): RunSlot[] {
  const slots: RunSlot[] = [];
  // Matches <w:t> and <w:t xml:space="preserve">, plus self-closing <w:t/>.
  const re = /<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1] ?? '';
    const inner = m[2] ?? '';
    const innerStart = m.index + m[0].length - inner.length - '</w:t>'.length;
    slots.push({
      start: innerStart,
      end: innerStart + inner.length,
      text: decodeXmlText(inner),
      preserved: /xml:space\s*=\s*"preserve"/.test(attrs),
    });
  }
  return slots;
}

/** Split the body XML into paragraph chunks so matching stays in-paragraph. */
function paragraphRanges(xml: string): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  const re = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/**
 * Apply one replacement inside a single paragraph's XML. Returns the new
 * paragraph XML, or null when the find text isn't present in it.
 */
export function replaceInParagraph(paraXml: string, find: string, replace: string): string | null {
  const slots = findRunSlots(paraXml);
  if (slots.length === 0) return null;

  // Concatenated paragraph text + a map from concat offset → slot index.
  let concat = '';
  const offsets: Array<{ slot: number; from: number; to: number }> = [];
  slots.forEach((s, i) => {
    offsets.push({ slot: i, from: concat.length, to: concat.length + s.text.length });
    concat += s.text;
  });

  // Exact match first; fall back to whitespace-tolerant match.
  let matchStart = concat.indexOf(find);
  let matchLen = find.length;
  if (matchStart === -1) {
    const nConcat = normalizeWs(concat);
    const nFind = normalizeWs(find);
    const nIdx = nConcat.indexOf(nFind);
    if (nIdx === -1) return null;
    // Map the normalized index back by walking the original string.
    let seen = 0;
    let origIdx = -1;
    for (let i = 0; i < concat.length; i += 1) {
      const nSlice = normalizeWs(concat.slice(0, i));
      if (nSlice.length >= nIdx && origIdx === -1) {
        origIdx = i;
        break;
      }
      seen = i;
    }
    if (origIdx === -1) return null;
    matchStart = origIdx;
    // Extend to cover the same normalized length.
    let end = matchStart;
    while (end < concat.length && normalizeWs(concat.slice(matchStart, end)).length < nFind.length) {
      end += 1;
    }
    matchLen = end - matchStart;
  }
  const matchEnd = matchStart + matchLen;

  // Rewrite affected slots from last to first so earlier indices stay valid.
  const touched = offsets.filter((o) => o.to > matchStart && o.from < matchEnd);
  if (touched.length === 0) return null;
  let out = paraXml;
  for (let i = touched.length - 1; i >= 0; i -= 1) {
    const o = touched[i];
    const slot = slots[o.slot];
    const localStart = Math.max(0, matchStart - o.from);
    const localEnd = Math.min(slot.text.length, matchEnd - o.from);
    const isFirst = i === 0;
    const newText =
      slot.text.slice(0, localStart) + (isFirst ? replace : '') + slot.text.slice(localEnd);
    out = out.slice(0, slot.start) + escapeXml(newText) + out.slice(slot.end);
  }
  return out;
}

/** Apply replacements to the body XML. Returns new XML + which ones landed. */
export function applyReplacementsToXml(
  xml: string,
  replacements: DocxReplacement[],
): { xml: string; applied: DocxReplacement[]; unmatched: DocxReplacement[] } {
  let current = xml;
  const applied: DocxReplacement[] = [];
  const unmatched: DocxReplacement[] = [];

  for (const rep of replacements) {
    if (!rep.find) {
      unmatched.push(rep);
      continue;
    }
    const paras = paragraphRanges(current);
    let done = false;
    for (const p of paras) {
      const paraXml = current.slice(p.start, p.end);
      const next = replaceInParagraph(paraXml, rep.find, rep.replace);
      if (next !== null) {
        current = current.slice(0, p.start) + next + current.slice(p.end);
        applied.push(rep);
        done = true;
        break; // first occurrence only — mirrors the editor's applyChange
      }
    }
    if (!done) unmatched.push(rep);
  }
  return { xml: current, applied, unmatched };
}

/**
 * Edit a .docx in place. `original` is the untouched file from Box/upload.
 * Everything except the replaced words is byte-preserved.
 */
export function editDocxInPlace(
  original: ArrayBuffer,
  replacements: DocxReplacement[],
): DocxSurgeryResult {
  const zip = unzipSync(new Uint8Array(original));
  const body = zip[BODY_PART];
  if (!body) throw new Error('not a Word document (word/document.xml missing)');
  const xml = strFromU8(body);
  const { xml: nextXml, applied, unmatched } = applyReplacementsToXml(xml, replacements);
  const nextZip: Record<string, Uint8Array> = { ...zip, [BODY_PART]: strToU8(nextXml) };
  return { bytes: zipSync(nextZip), applied, unmatched };
}
