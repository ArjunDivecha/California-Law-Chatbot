/**
 * tests/docx-surgery.test.mjs
 *
 * Tests for utils/docxSurgery.ts — in-place text editing of a .docx that
 * preserves the original formatting (2026-08-17; added after Save-to-Box
 * rebuilt firm documents from plain text and destroyed their styling).
 *
 * Builds a REAL .docx with the `docx` package (bold runs, a heading, a
 * numbered list), edits it in place, then re-reads it to prove:
 *   - the replacement text landed,
 *   - formatting/styles/numbering XML survived byte-for-byte,
 *   - phrases split across runs are handled (Word's usual case),
 *   - unmatched replacements are REPORTED, never silently dropped.
 *
 * Input files:  none
 * Output files: none (temp docx built in memory)
 * Usage:        ./node_modules/.bin/tsx tests/docx-surgery.test.mjs
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, Header } from 'docx';
import { unzipSync, strFromU8 } from 'fflate';
import { editDocxInPlace, replaceInParagraph } from '../utils/docxSurgery.ts';

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) { passed += 1; console.log(`✅ ${name}`); }
  else { failed += 1; console.error(`❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

const bodyOf = (bytes) => strFromU8(unzipSync(bytes)['word/document.xml']);
const decodeEntities = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&');
const textOf = (xml) => (xml.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) ?? [])
  .map((t) => decodeEntities(t.replace(/<[^>]+>/g, '')))
  .join('');

// ---------- build a formatted source document ----------
const doc = new Document({
  sections: [{
    properties: {},
    children: [
      new Paragraph({ text: 'ARTICLE FIVE: SUCCESSOR EXECUTORS', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({
        children: [
          new TextRun({ text: 'I appoint ' }),
          new TextRun({ text: 'Zai Divecha', bold: true }),      // split across runs
          new TextRun({ text: ' as my Successor Executor.' }),
        ],
      }),
      new Paragraph({
        children: [new TextRun({ text: 'The residue shall pass to my descendants.', italics: true })],
      }),
      new Paragraph({ text: 'First item', numbering: { reference: 'x', level: 0 } }),
    ],
  }],
});
const originalBytes = await Packer.toBuffer(doc);
const originalXml = bodyOf(new Uint8Array(originalBytes));
const originalBoldCount = (originalXml.match(/<w:b\/>|<w:b /g) ?? []).length;
const originalItalicCount = (originalXml.match(/<w:i\/>|<w:i /g) ?? []).length;
const originalStyleCount = (originalXml.match(/<w:pStyle /g) ?? []).length;

check('fixture has formatting to preserve', originalBoldCount > 0 && originalItalicCount > 0 && originalStyleCount > 0,
  `bold=${originalBoldCount} italic=${originalItalicCount} styles=${originalStyleCount}`);

// ---------- 1. simple in-run replacement ----------
let res = editDocxInPlace(originalBytes.buffer ?? originalBytes, [
  { find: 'The residue shall pass to my descendants.', replace: 'The residue shall pass to my issue.' },
]);
let xml = bodyOf(res.bytes);
check('replacement applied', res.applied.length === 1 && res.unmatched.length === 0);
check('new text present', textOf(xml).includes('pass to my issue'));
check('old text gone', !textOf(xml).includes('pass to my descendants'));
check('italics preserved', (xml.match(/<w:i\/>|<w:i /g) ?? []).length === originalItalicCount);
check('heading style preserved', (xml.match(/<w:pStyle /g) ?? []).length === originalStyleCount);
check('numbering preserved', xml.includes('<w:numPr>') === originalXml.includes('<w:numPr>'));
check('other parts intact', Object.keys(unzipSync(res.bytes)).length === Object.keys(unzipSync(new Uint8Array(originalBytes))).length);

// ---------- 2. phrase split across runs (the Word-typical case) ----------
res = editDocxInPlace(originalBytes.buffer ?? originalBytes, [
  { find: 'I appoint Zai Divecha as my Successor Executor.', replace: 'I appoint Kiran Divecha as my Successor Executor.' },
]);
xml = bodyOf(res.bytes);
check('cross-run phrase matched', res.applied.length === 1, JSON.stringify(res.unmatched));
check('cross-run replacement text correct', textOf(xml).includes('I appoint Kiran Divecha as my Successor Executor.'));
check('no duplicated leftovers from later runs', !textOf(xml).includes('Zai Divecha'));
check('bold run still exists after cross-run edit', (xml.match(/<w:b\/>|<w:b /g) ?? []).length === originalBoldCount);

// ---------- 3. multiple replacements in one pass ----------
res = editDocxInPlace(originalBytes.buffer ?? originalBytes, [
  { find: 'Zai Divecha', replace: 'Kiran Divecha' },
  { find: 'First item', replace: 'Amended first item' },
]);
check('both replacements applied', res.applied.length === 2 && res.unmatched.length === 0);
check('both texts present', textOf(bodyOf(res.bytes)).includes('Kiran Divecha') && textOf(bodyOf(res.bytes)).includes('Amended first item'));

// ---------- 4. unmatched is reported, not silent ----------
res = editDocxInPlace(originalBytes.buffer ?? originalBytes, [
  { find: 'text that does not exist anywhere', replace: 'x' },
  { find: 'First item', replace: 'Renamed item' },
]);
check('unmatched reported', res.unmatched.length === 1 && res.unmatched[0].find.startsWith('text that does not'));
check('matched sibling still applied', res.applied.length === 1);

// ---------- 5. XML-escaping of replacement content ----------
res = editDocxInPlace(originalBytes.buffer ?? originalBytes, [
  { find: 'First item', replace: 'Smith & Jones <Trustees> "the Trust"' },
]);
xml = bodyOf(res.bytes);
check('special chars escaped in XML', xml.includes('Smith &amp; Jones &lt;Trustees&gt;'));
check('document still parses as text', textOf(xml).includes('Smith & Jones <Trustees> "the Trust"'));

// ---------- 5b. whitespace-fallback alignment (2026-08-17 corruption bug) ----------
// The old approximate index-mapping misaligned any match that followed a
// multi-space gap, fusing stray characters onto the replacement ("Trusteee",
// "quarterly..") and silently corrupting saved documents. These pin the fix.
const mkPara = (...runs) =>
  '<w:p>' + runs.map((r) => `<w:r><w:t xml:space="preserve">${r}</w:t></w:r>`).join('') + '</w:p>';
{
  const cases = [
    { name: 'match after multi-space gap', para: mkPara('Name:     John Roe, Trustee'), find: 'John  Roe, Trustee', replace: 'Jane Doe, Trustee', want: 'Name:     Jane Doe, Trustee' },
    { name: 'numbered clause after gap', para: mkPara('5.1    The Trustee shall account annually.'), find: 'The  Trustee shall account annually.', replace: 'The Trustee shall account quarterly.', want: '5.1    The Trustee shall account quarterly.' },
    { name: 'single char after gap', para: mkPara('A   B'), find: 'B', replace: 'C', want: 'A   C' },
    { name: 'gap inside doc, single space in find', para: mkPara('The  Trustee shall distribute.'), find: 'The Trustee shall distribute.', replace: 'The Trustee may distribute.', want: 'The Trustee may distribute.' },
  ];
  for (const c of cases) {
    const out = replaceInParagraph(c.para, c.find, c.replace);
    check(`ws-fallback exact: ${c.name}`, out !== null && textOf(out) === c.want,
      out === null ? 'no match' : JSON.stringify(textOf(out)));
  }
  check('ws-fallback: whitespace-only find rejected', replaceInParagraph(mkPara('a  b'), '   ', 'x') === null);
}

// ---------- 6. paragraph-level helper ----------
const para = '<w:p><w:r><w:t>Hello </w:t></w:r><w:r><w:t>world</w:t></w:r></w:p>';
check('replaceInParagraph handles split text', (replaceInParagraph(para, 'Hello world', 'Goodbye world') ?? '').includes('Goodbye world'));
check('replaceInParagraph returns null when absent', replaceInParagraph(para, 'nothing here', 'x') === null);

// ---------- 7. letterhead logo in the header survives byte-for-byte ----------
// The firm's engagement letters carry a logo in word/header*.xml +
// word/media/*. The surgery only rewrites word/document.xml, so these must
// pass through untouched (asked 2026-08-17 about Femme's letterhead).
{
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const letter = new Document({
    sections: [{
      headers: {
        default: new Header({
          children: [new Paragraph({ children: [new ImageRun({ type: 'png', data: png, transformation: { width: 40, height: 40 } })] })],
        }),
      },
      children: [new Paragraph({ children: [new TextRun('Dear CLIENT 1 and CLIENT 2:')] })],
    }],
  });
  const src = await Packer.toBuffer(letter);
  const before = unzipSync(new Uint8Array(src));
  const mediaKeys = Object.keys(before).filter((k) => k.startsWith('word/media/'));
  const headerKeys = Object.keys(before).filter((k) => /word\/header\d*\.xml$/.test(k));
  check('logo fixture has media + header parts', mediaKeys.length > 0 && headerKeys.length > 0,
    `media=${mediaKeys.length} header=${headerKeys.length}`);
  const edited = editDocxInPlace(src.buffer ?? src, [
    { find: 'Dear CLIENT 1 and CLIENT 2:', replace: 'Dear Arjun Divecha and Diana Divecha:' },
  ]);
  const after = unzipSync(edited.bytes);
  const identical = (k) => after[k] && Buffer.compare(Buffer.from(before[k]), Buffer.from(after[k])) === 0;
  check('logo edit applied', edited.applied.length === 1 && edited.unmatched.length === 0);
  check('logo image bytes identical', mediaKeys.every(identical));
  check('header XML identical', headerKeys.every(identical));
  check('no parts lost', Object.keys(before).length === Object.keys(after).length);
  check('body text replaced under logo', textOf(bodyOf(edited.bytes)).includes('Dear Arjun Divecha and Diana Divecha:'));
}

console.log(`\nDOCX surgery: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
