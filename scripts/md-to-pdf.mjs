/**
 * Markdown → PDF converter for partner/attorney-facing documents.
 *
 * Used by the .pkg installer rollout to produce nicely-typeset versions
 * of ATTORNEY-INSTALL.md and EMAIL-DRAFT.md. Pandoc would do this too
 * but needs LaTeX; Playwright + marked gives full CSS control and we
 * already have Chromium installed.
 *
 * Usage:
 *   node scripts/md-to-pdf.mjs <input.md> <output.pdf> [title]
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { marked } from 'marked';
import { chromium } from 'playwright';

const [, , input, output, title = 'California Law Chatbot'] = process.argv;
if (!input || !output) {
  console.error('Usage: node md-to-pdf.mjs <input.md> <output.pdf> [title]');
  process.exit(1);
}

const md = readFileSync(resolve(input), 'utf8');

// Strip the "Notes for Arjun" tail section if present — that block is
// for the human running the rollout, not a deliverable.
const stripped = md.replace(/\n# Notes for Arjun[\s\S]*$/m, '').trimEnd();

const bodyHtml = marked.parse(stripped);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  @page {
    size: Letter;
    margin: 0.85in 0.95in 0.95in 0.95in;
  }
  html, body {
    margin: 0;
    padding: 0;
    color: #1f2937;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11.5pt;
    line-height: 1.55;
  }
  h1 {
    font-size: 22pt;
    color: #111827;
    border-bottom: 2px solid #ec4899;
    padding-bottom: 6pt;
    margin: 0 0 14pt;
  }
  h2 {
    font-size: 14pt;
    color: #be185d;
    margin: 22pt 0 8pt;
    page-break-after: avoid;
  }
  h3 {
    font-size: 12pt;
    color: #1f2937;
    margin: 16pt 0 6pt;
  }
  p, ul, ol {
    margin: 8pt 0;
  }
  ul, ol { padding-left: 22pt; }
  li { margin: 3pt 0; }
  strong { color: #111827; }
  em { color: #4b5563; }
  a { color: #be185d; text-decoration: underline; }
  code {
    font-family: "SF Mono", "Menlo", "Consolas", monospace;
    font-size: 10pt;
    background: #f3f4f6;
    padding: 1pt 4pt;
    border-radius: 3pt;
    color: #1f2937;
  }
  pre {
    background: #f9fafb;
    border: 1pt solid #e5e7eb;
    border-radius: 4pt;
    padding: 10pt 12pt;
    font-size: 10pt;
    line-height: 1.45;
    overflow-wrap: break-word;
    word-break: break-word;
    page-break-inside: avoid;
  }
  pre code { background: transparent; padding: 0; }
  hr {
    border: 0;
    border-top: 1pt solid #e5e7eb;
    margin: 18pt 0;
  }
  blockquote {
    border-left: 3pt solid #fbcfe8;
    margin: 10pt 0;
    padding: 4pt 0 4pt 12pt;
    color: #4b5563;
    font-style: italic;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 10pt 0;
    font-size: 10.5pt;
  }
  th, td {
    border: 1pt solid #e5e7eb;
    padding: 5pt 8pt;
    text-align: left;
    vertical-align: top;
  }
  th { background: #fdf2f8; color: #9d174d; font-weight: 700; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.pdf({
  path: resolve(output),
  format: 'Letter',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: `<div></div>`,
  footerTemplate: `
    <div style="width:100%; padding:0 0.5in; font-family: Georgia, serif; font-size: 8.5pt; color:#9ca3af; display:flex; justify-content:space-between;">
      <span>F&F Law · California Law Chatbot</span>
      <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>`,
  margin: { top: '0.85in', right: '0.95in', bottom: '0.95in', left: '0.95in' },
});
await browser.close();
console.log(`wrote ${resolve(output)}`);
