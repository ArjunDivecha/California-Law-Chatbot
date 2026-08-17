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
 *   No formatting changes and no structural edits. Text spanning paragraph
 *   boundaries is handled by a second, cross-paragraph pass that preserves
 *   the paragraph structure (see replaceAcrossParagraphs). Replacements
 *   that cannot be located are reported to the caller (never silently
 *   dropped) so the UI can fall back or warn.
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

/** Canonicalize typographic characters Word substitutes automatically —
 *  curly quotes, en/em dashes, non-breaking hyphens, NBSP — so a find
 *  string written with straight quotes still matches the document. The
 *  mapping is strictly 1 char → 1 char, so indices are preserved. */
function canonChar(c: string): string {
  switch (c) {
    case '‘': case '’': case 'ʼ': return "'";
    case '“': case '”': return '"';
    case '–': case '—': case '‑': case '−': return '-';
    case ' ': return ' ';
    default: return c;
  }
}
function canonicalize(s: string): string {
  let out = '';
  for (const c of s) out += canonChar(c);
  return out;
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
  /** Decoded text of the run (a single ' ' for tab/break markers). */
  text: string;
  /** True when the <w:t> carries xml:space="preserve". */
  preserved: boolean;
  /** False for <w:tab/>/<w:br/>/<w:cr/> markers: they render as whitespace
   *  (so they participate in matching) but their XML is never rewritten. */
  editable: boolean;
}

/** Find every text slot in a chunk of document XML, in document order:
 *  <w:t> runs (editable) plus tab/line-break markers (whitespace-only).
 *  Extracted plain text renders <w:tab/> as a space, so a find string
 *  taken from it contains ' ' where the XML has a tab element — without
 *  these pseudo-slots such finds could never match (2026-08-17). */
function findRunSlots(xml: string): RunSlot[] {
  const slots: RunSlot[] = [];
  const re = /<w:t(\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(?:tab|br|cr)\s*\/>|<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (m[2] !== undefined) {
      const attrs = m[1] ?? '';
      const inner = m[2];
      const innerStart = m.index + m[0].length - inner.length - '</w:t>'.length;
      slots.push({
        start: innerStart,
        end: innerStart + inner.length,
        text: decodeXmlText(inner),
        preserved: /xml:space\s*=\s*"preserve"/.test(attrs),
        editable: true,
      });
    } else {
      // Paragraph ends render as a newline in extracted text; tabs/breaks
      // as a space. Both are matchable whitespace, never rewritten.
      const text = m[0] === '</w:p>' ? '\n' : ' ';
      slots.push({ start: m.index, end: m.index + m[0].length, text, preserved: false, editable: false });
    }
  }
  return slots;
}

/** Locate `find` in the concatenated slot text: exact, then canonicalized
 *  (curly quotes/dashes/NBSP), then whitespace-tolerant with an exact
 *  position map. Returns the matched [start, len) span, or null. */
function locateMatch(concat: string, find: string): { start: number; len: number } | null {
  let matchStart = concat.indexOf(find);
  if (matchStart !== -1) return { start: matchStart, len: find.length };
  matchStart = canonicalize(concat).indexOf(canonicalize(find));
  if (matchStart !== -1) return { start: matchStart, len: find.length };
  let norm = '';
  const normStart: number[] = [];
  const normEnd: number[] = [];
  let i = 0;
  while (i < concat.length) {
    if (/[\s ]/.test(concat[i])) {
      let j = i;
      while (j < concat.length && /[\s ]/.test(concat[j])) j += 1;
      norm += ' ';
      normStart.push(i);
      normEnd.push(j);
      i = j;
    } else {
      norm += canonChar(concat[i]);
      normStart.push(i);
      normEnd.push(i + 1);
      i += 1;
    }
  }
  const nFind = normalizeWs(canonicalize(find)).trim();
  if (nFind.length === 0) return null;
  const nIdx = norm.indexOf(nFind);
  if (nIdx === -1) return null;
  const start = normStart[nIdx];
  return { start, len: normEnd[nIdx + nFind.length - 1] - start };
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

  const located = locateMatch(concat, find);
  if (!located) return null;
  const matchStart = located.start;
  const matchEnd = matchStart + located.len;

  // Rewrite affected slots from last to first so earlier indices stay valid.
  // Tab/break pseudo-slots inside the match are left untouched: their XML
  // stays, and the replacement lands in the first EDITABLE slot, so a match
  // spanning "5.1<tab>Text" keeps the tab and types over the text.
  const touched = offsets.filter((o) => o.to > matchStart && o.from < matchEnd && slots[o.slot].editable);
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

/**
 * Apply one replacement across paragraph boundaries. Used only when no
 * single paragraph contains the find text (2026-08-17: real engagement
 * letters produced finds like "Re: … Agreement\nDear [NAMES]" and
 * multi-line signature blocks, which the per-paragraph pass can never
 * match). Paragraph structure is preserved: the replacement is split on
 * newlines and distributed across the matched paragraphs in order — the
 * k-th replacement line lands in the k-th matched paragraph's first
 * touched run, surplus document text in the span is blanked, and surplus
 * replacement lines are appended to the last paragraph's text.
 * Returns the new body XML, or null when the find isn't present at all.
 */
export function replaceAcrossParagraphs(xml: string, find: string, replace: string): string | null {
  const slots = findRunSlots(xml);
  if (slots.length === 0) return null;

  let concat = '';
  const offsets: Array<{ slot: number; from: number; to: number }> = [];
  slots.forEach((s, i) => {
    offsets.push({ slot: i, from: concat.length, to: concat.length + s.text.length });
    concat += s.text;
  });

  const located = locateMatch(concat, find);
  if (!located) return null;
  const matchStart = located.start;
  const matchEnd = matchStart + located.len;

  const touched = offsets.filter((o) => o.to > matchStart && o.from < matchEnd && slots[o.slot].editable);
  if (touched.length === 0) return null;

  // Paragraph index for each slot = number of </w:p> pseudo-slots before it.
  const paraIndexOfSlot: number[] = [];
  let paraCounter = 0;
  slots.forEach((s, i) => {
    paraIndexOfSlot[i] = paraCounter;
    if (!s.editable && s.text === '\n') paraCounter += 1;
  });

  // Distribute the replacement lines over the matched paragraphs in order.
  const paraOrder: number[] = [];
  for (const o of touched) {
    const pi = paraIndexOfSlot[o.slot];
    if (paraOrder[paraOrder.length - 1] !== pi) paraOrder.push(pi);
  }
  const lines = replace.split(/\n+/);
  if (lines.length > paraOrder.length) {
    // Surplus lines: merge the tail into the last available paragraph.
    const head = lines.slice(0, paraOrder.length - 1);
    const tail = lines.slice(paraOrder.length - 1).join(' ');
    lines.length = 0;
    lines.push(...head, tail);
  }
  const lineForPara = new Map<number, string>();
  paraOrder.forEach((pi, k) => lineForPara.set(pi, lines[k] ?? ''));

  // First touched slot per paragraph receives that paragraph's line; every
  // other touched slot's matched span is blanked. Rewrite last → first.
  const firstSlotForPara = new Map<number, number>();
  for (const o of touched) {
    const pi = paraIndexOfSlot[o.slot];
    if (!firstSlotForPara.has(pi)) firstSlotForPara.set(pi, o.slot);
  }
  let out = xml;
  for (let i = touched.length - 1; i >= 0; i -= 1) {
    const o = touched[i];
    const slot = slots[o.slot];
    const localStart = Math.max(0, matchStart - o.from);
    const localEnd = Math.min(slot.text.length, matchEnd - o.from);
    const pi = paraIndexOfSlot[o.slot];
    const insert = firstSlotForPara.get(pi) === o.slot ? (lineForPara.get(pi) ?? '') : '';
    const newText = slot.text.slice(0, localStart) + insert + slot.text.slice(localEnd);
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
    if (!done) {
      // Cross-paragraph pass — only when no single paragraph matched.
      const next = replaceAcrossParagraphs(current, rep.find, rep.replace);
      if (next !== null) {
        current = next;
        applied.push(rep);
        done = true;
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
