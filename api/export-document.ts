/**
 * Export Document API Endpoint
 * 
 * POST /api/export-document - Export a document to HTML (for PDF/print)
 * 
 * Note: Full PDF generation requires a PDF library. This endpoint generates
 * print-ready HTML that can be printed to PDF from the browser.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { GeneratedDocument, DocumentFormatting } from '../types';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

interface ExportDocumentRequest {
  document: GeneratedDocument;
  format: 'html' | 'pdf';
  formatting?: {
    includeLineNumbers?: boolean;
    includeTableOfContents?: boolean;
    includeTableOfAuthorities?: boolean;
    headerText?: string;
    footerText?: string;
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  try {
    const request: ExportDocumentRequest = req.body;

    // Validate request
    if (!request.document) {
      return res.status(400).json({ error: 'document is required' });
    }

    console.log('📄 Export Document API: Generating export');
    console.log(`   Format: ${request.format || 'html'}`);
    console.log(`   Template: ${request.document.templateName}`);

    // Generate HTML
    const html = generateExportHTML(request.document, request.formatting);

    // Return HTML (can be printed to PDF from browser)
    if (request.format === 'html' || !request.format) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(html);
    }

    // For PDF, return the HTML with instructions
    // (Full PDF generation would require a library like puppeteer)
    return res.status(200).json({
      format: 'html',
      html,
      instructions: 'Print this HTML to PDF using your browser or a PDF library',
      fileName: `${request.document.templateId}_${Date.now()}.html`,
    });

  } catch (error) {
    console.error('❌ Export Document API error:', error);
    
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Export failed',
    });
  }
}

/**
 * Generate print-ready HTML from a document
 */
function generateExportHTML(
  document: GeneratedDocument,
  options?: ExportDocumentRequest['formatting']
): string {
  const formatting = document.formatting;

  // Build CSS
  const css = `
    @page {
      margin: ${formatting.margins.top}in ${formatting.margins.right}in ${formatting.margins.bottom}in ${formatting.margins.left}in;
      ${formatting.pageNumbers ? `
        @bottom-center {
          content: counter(page);
        }
      ` : ''}
    }

    body {
      font-family: "${formatting.fontFamily}", Times, serif;
      font-size: ${formatting.fontSize}pt;
      line-height: ${formatting.lineSpacing === 'double' ? '2' : formatting.lineSpacing === '1.5' ? '1.5' : '1.4'};
      color: #000;
      max-width: 8.5in;
      margin: 0 auto;
      padding: 1in;
    }

    h1 {
      font-size: 14pt;
      font-weight: bold;
      text-align: center;
      margin-bottom: 1em;
    }

    h2 {
      font-size: 13pt;
      font-weight: bold;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
    }

    h3 {
      font-size: 12pt;
      font-weight: bold;
      margin-top: 1em;
      margin-bottom: 0.5em;
    }

    p {
      text-indent: 0.5in;
      margin-bottom: 0.5em;
    }

    .section {
      margin-bottom: 1.5em;
    }

    .section-title {
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 0.5em;
    }

    .header-block {
      margin-bottom: 2em;
    }

    .header-block p {
      text-indent: 0;
      margin-bottom: 0.25em;
    }

    .signature-block {
      margin-top: 2em;
    }

    .signature-block p {
      text-indent: 0;
      margin-bottom: 0.25em;
    }

    ${options?.includeLineNumbers ? `
      .content {
        counter-reset: line;
      }
      .content p {
        counter-increment: line;
        position: relative;
      }
      .content p::before {
        content: counter(line);
        position: absolute;
        left: -2em;
        width: 1.5em;
        text-align: right;
        color: #999;
        font-size: 10pt;
      }
    ` : ''}

    .toa {
      margin-top: 2em;
      page-break-before: always;
    }

    .toa-title {
      font-weight: bold;
      text-align: center;
      text-transform: uppercase;
      margin-bottom: 1em;
    }

    .toa-section {
      margin-bottom: 1em;
    }

    .toa-section-title {
      font-weight: bold;
      text-decoration: underline;
    }

    .toa-entry {
      display: flex;
      justify-content: space-between;
      text-indent: 1em;
    }

    .verification-badge {
      background: #f0f0f0;
      padding: 0.5em 1em;
      border-radius: 4px;
      font-size: 10pt;
      margin-bottom: 1em;
    }

    @media print {
      body {
        padding: 0;
      }
    }
  `;

  // Build HTML content
  let content = '';

  for (const section of document.sections) {
    content += `
      <div class="section" id="section-${section.sectionId}">
        ${section.sectionName !== 'Header' && section.sectionName !== 'Letterhead' ? 
          `<h2 class="section-title">${section.sectionName}</h2>` : ''}
        <div class="content">
          ${convertMarkdownToHTML(section.content)}
        </div>
      </div>
    `;
  }

  // Add Table of Authorities if requested
  let toaHTML = '';
  if (options?.includeTableOfAuthorities && document.citationReport?.tableOfAuthorities) {
    const toa = document.citationReport.tableOfAuthorities;
    const cases = toa.filter(e => e.type === 'case');
    const statutes = toa.filter(e => e.type === 'statute');
    const secondary = toa.filter(e => e.type === 'secondary');

    toaHTML = `
      <div class="toa">
        <div class="toa-title">TABLE OF AUTHORITIES</div>
        
        ${cases.length > 0 ? `
          <div class="toa-section">
            <div class="toa-section-title">Cases</div>
            ${cases.map(c => `
              <div class="toa-entry">
                <span>${c.citation}</span>
                <span>${c.pageReferences}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${statutes.length > 0 ? `
          <div class="toa-section">
            <div class="toa-section-title">Statutes</div>
            ${statutes.map(s => `
              <div class="toa-entry">
                <span>${s.citation}</span>
                <span>${s.pageReferences}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${secondary.length > 0 ? `
          <div class="toa-section">
            <div class="toa-section-title">Secondary Sources</div>
            ${secondary.map(s => `
              <div class="toa-entry">
                <span>${s.citation}</span>
                <span>${s.pageReferences}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  // Build verification badge
  const verificationBadge = document.verificationReport ? `
    <div class="verification-badge">
      Verification Score: ${document.verificationReport.overallScore}/100 | 
      Status: ${document.verificationReport.approvalStatus} |
      Generated: ${new Date(document.createdAt).toLocaleDateString()}
    </div>
  ` : '';

  // Assemble full HTML
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${document.templateName}</title>
      <style>${css}</style>
    </head>
    <body>
      ${verificationBadge}
      ${content}
      ${toaHTML}
    </body>
    </html>
  `;
}

/**
 * Convert basic markdown to HTML
 */
function convertMarkdownToHTML(markdown: string): string {
  let html = markdown;

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');

  // Line breaks and paragraphs
  const lines = html.split('\n');
  let inParagraph = false;
  let result = '';

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed === '') {
      if (inParagraph) {
        result += '</p>\n';
        inParagraph = false;
      }
    } else if (trimmed.startsWith('<h') || trimmed.startsWith('<hr')) {
      if (inParagraph) {
        result += '</p>\n';
        inParagraph = false;
      }
      result += trimmed + '\n';
    } else {
      if (!inParagraph) {
        result += '<p>';
        inParagraph = true;
      } else {
        result += ' ';
      }
      result += trimmed;
    }
  }

  if (inParagraph) {
    result += '</p>';
  }

  return result;
}
