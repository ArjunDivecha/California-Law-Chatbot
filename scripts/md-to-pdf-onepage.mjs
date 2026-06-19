/**
 * Compact one-page variant of md-to-pdf — same conversion path but with
 * tighter typography for executive-summary documents. 10pt body,
 * 0.6in margins, compact tables and lists.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { marked } from 'marked';
import { chromium } from 'playwright';

const [, , input, output, title = 'F&F Law'] = process.argv;
if (!input || !output) {
  console.error('Usage: node md-to-pdf-onepage.mjs <input.md> <output.pdf> [title]');
  process.exit(1);
}

const md = readFileSync(resolve(input), 'utf8');
const stripped = md.replace(/\n# Notes for Arjun[\s\S]*$/m, '').trimEnd();
const bodyHtml = marked.parse(stripped);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  @page { size: Letter; margin: 0.55in 0.6in; }
  html, body {
    margin: 0; padding: 0; color: #1f2937;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 10pt; line-height: 1.35;
  }
  h1 {
    font-size: 17pt; color: #111827;
    border-bottom: 1.5pt solid #ec4899;
    padding-bottom: 3pt;
    margin: 0 0 8pt;
  }
  h2 {
    font-size: 11pt; color: #be185d;
    margin: 9pt 0 3pt;
    page-break-after: avoid;
  }
  p, ul, ol { margin: 4pt 0; }
  ul, ol { padding-left: 16pt; }
  li { margin: 1pt 0; }
  strong { color: #111827; }
  em { color: #4b5563; }
  a { color: #be185d; text-decoration: underline; }
  code {
    font-family: "SF Mono", "Menlo", monospace;
    font-size: 8.5pt;
    background: #f3f4f6;
    padding: 0.5pt 2pt;
    border-radius: 2pt;
  }
  pre {
    background: #f9fafb;
    border: 0.5pt solid #e5e7eb;
    padding: 6pt 8pt;
    font-size: 8.5pt;
    line-height: 1.3;
    page-break-inside: avoid;
  }
  hr { border: 0; border-top: 0.5pt solid #e5e7eb; margin: 6pt 0; }
  table {
    border-collapse: collapse; width: 100%;
    margin: 4pt 0; font-size: 9pt;
  }
  th, td {
    border: 0.5pt solid #e5e7eb;
    padding: 2pt 5pt;
    text-align: left; vertical-align: top;
  }
  th { background: #fdf2f8; color: #9d174d; font-weight: 700; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.pdf({
  path: resolve(output),
  format: 'Letter',
  printBackground: true,
  displayHeaderFooter: false,
  margin: { top: '0.55in', right: '0.6in', bottom: '0.55in', left: '0.6in' },
});
await browser.close();
console.log(`wrote ${resolve(output)}`);
