/**
 * Export Document API Endpoint
 * 
 * POST /api/export-document - Export a document to DOCX or PDF
 * 
 * Supports:
 * - DOCX: Editable Word document using 'docx' library
 * - PDF: Print-ready PDF using 'jspdf' library
 * - HTML: Print-ready HTML (fallback)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} from 'docx';
import { jsPDF } from 'jspdf';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

interface GeneratedSection {
  sectionId: string;
  sectionName: string;
  content: string;
  wordCount: number;
  citations: string[];
  generatedAt: string;
  revisionCount: number;
}

interface DocumentFormatting {
  fontFamily: string;
  fontSize: number;
  lineSpacing: 'single' | 'double' | '1.5';
  margins: { top: number; bottom: number; left: number; right: number };
  pageNumbers: boolean;
  lineNumbers?: boolean;
}

interface GeneratedDocument {
  id: string;
  templateId: string;
  templateName: string;
  sections: GeneratedSection[];
  formatting: DocumentFormatting;
  createdAt: string;
  verificationReport?: {
    overallScore: number;
    approvalStatus: string;
  };
  citationReport?: {
    tableOfAuthorities?: Array<{ citation: string; type: string; pageReferences: string }>;
  };
}

interface ExportDocumentRequest {
  document: GeneratedDocument;
  format: 'docx' | 'pdf' | 'html';
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

    const format = request.format || 'docx';
    console.log('📄 Export Document API: Generating export');
    console.log(`   Format: ${format}`);
    console.log(`   Template: ${request.document.templateName}`);

    const fileName = `${request.document.templateId}_${Date.now()}`;

    if (format === 'docx') {
      // Generate DOCX
      const buffer = await generateDOCX(request.document, request.formatting);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.docx"`);
      return res.status(200).send(Buffer.from(buffer));
    } else if (format === 'pdf') {
      // Generate PDF
      const pdfBuffer = generatePDF(request.document, request.formatting);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
      return res.status(200).send(Buffer.from(pdfBuffer));
    } else {
      // Generate HTML
      const html = generateExportHTML(request.document, request.formatting);
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}.html"`);
      return res.status(200).send(html);
    }

  } catch (error) {
    console.error('❌ Export Document API error:', error);
    
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Export failed',
    });
  }
}

// =============================================================================
// DOCX GENERATION
// =============================================================================

async function generateDOCX(
  document: GeneratedDocument,
  options?: ExportDocumentRequest['formatting']
): Promise<ArrayBuffer> {
  const formatting = document.formatting;
  
  // Convert markdown content to docx paragraphs
  const children: Paragraph[] = [];
  
  for (const section of document.sections) {
    // Add section title (except for Header/Letterhead)
    if (section.sectionName !== 'Header' && section.sectionName !== 'Letterhead') {
      children.push(
        new Paragraph({
          text: section.sectionName.toUpperCase(),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        })
      );
    }
    
    // Parse markdown content into paragraphs
    const contentParagraphs = parseMarkdownToDocx(section.content, formatting);
    children.push(...contentParagraphs);
  }
  
  // Add Table of Authorities if requested
  if (options?.includeTableOfAuthorities && document.citationReport?.tableOfAuthorities) {
    children.push(
      new Paragraph({
        text: '',
        pageBreakBefore: true,
      }),
      new Paragraph({
        text: 'TABLE OF AUTHORITIES',
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      })
    );
    
    const toa = document.citationReport.tableOfAuthorities;
    const cases = toa.filter(e => e.type === 'case');
    const statutes = toa.filter(e => e.type === 'statute');
    const secondary = toa.filter(e => e.type === 'secondary');
    
    if (cases.length > 0) {
      children.push(
        new Paragraph({
          text: 'Cases',
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        })
      );
      cases.forEach(c => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: c.citation, italics: true }),
              new TextRun({ text: ` ..... ${c.pageReferences}` }),
            ],
            indent: { left: convertInchesToTwip(0.5) },
          })
        );
      });
    }
    
    if (statutes.length > 0) {
      children.push(
        new Paragraph({
          text: 'Statutes',
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        })
      );
      statutes.forEach(s => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: s.citation }),
              new TextRun({ text: ` ..... ${s.pageReferences}` }),
            ],
            indent: { left: convertInchesToTwip(0.5) },
          })
        );
      });
    }
    
    if (secondary.length > 0) {
      children.push(
        new Paragraph({
          text: 'Secondary Sources',
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        })
      );
      secondary.forEach(s => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: s.citation }),
              new TextRun({ text: ` ..... ${s.pageReferences}` }),
            ],
            indent: { left: convertInchesToTwip(0.5) },
          })
        );
      });
    }
  }

  // Create the document
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(formatting.margins.top),
            bottom: convertInchesToTwip(formatting.margins.bottom),
            left: convertInchesToTwip(formatting.margins.left),
            right: convertInchesToTwip(formatting.margins.right),
          },
        },
      },
      headers: formatting.pageNumbers ? {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: document.templateName, size: 20 }),
              ],
            }),
          ],
        }),
      } : undefined,
      footers: formatting.pageNumbers ? {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'Page ' }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                }),
                new TextRun({ text: ' of ' }),
                new TextRun({
                  children: [PageNumber.TOTAL_PAGES],
                }),
              ],
            }),
          ],
        }),
      } : undefined,
      children,
    }],
  });

  // Generate buffer
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

/**
 * Parse markdown content into docx paragraphs
 */
function parseMarkdownToDocx(markdown: string, formatting: DocumentFormatting): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = markdown.split('\n');
  
  let currentParagraphRuns: TextRun[] = [];
  
  const flushParagraph = () => {
    if (currentParagraphRuns.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: currentParagraphRuns,
          spacing: {
            line: formatting.lineSpacing === 'double' ? 480 : formatting.lineSpacing === '1.5' ? 360 : 240,
            after: 200,
          },
          indent: { firstLine: convertInchesToTwip(0.5) },
        })
      );
      currentParagraphRuns = [];
    }
  };
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed === '') {
      flushParagraph();
      continue;
    }
    
    // Handle headers
    if (trimmed.startsWith('### ')) {
      flushParagraph();
      paragraphs.push(
        new Paragraph({
          text: trimmed.substring(4),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        })
      );
      continue;
    }
    
    if (trimmed.startsWith('## ')) {
      flushParagraph();
      paragraphs.push(
        new Paragraph({
          text: trimmed.substring(3),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
        })
      );
      continue;
    }
    
    if (trimmed.startsWith('# ')) {
      flushParagraph();
      paragraphs.push(
        new Paragraph({
          text: trimmed.substring(2),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );
      continue;
    }
    
    // Handle horizontal rule
    if (trimmed === '---') {
      flushParagraph();
      paragraphs.push(
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
          },
          spacing: { before: 200, after: 200 },
        })
      );
      continue;
    }
    
    // Parse inline formatting (bold, italic)
    const runs = parseInlineFormatting(trimmed, formatting.fontSize);
    
    if (currentParagraphRuns.length > 0) {
      currentParagraphRuns.push(new TextRun({ text: ' ', size: formatting.fontSize * 2 }));
    }
    currentParagraphRuns.push(...runs);
  }
  
  flushParagraph();
  
  return paragraphs;
}

/**
 * Parse inline markdown formatting (bold, italic) into TextRuns
 */
function parseInlineFormatting(text: string, fontSize: number): TextRun[] {
  const runs: TextRun[] = [];
  
  // Simple regex-based parsing for **bold** and *italic*
  let remaining = text;
  
  while (remaining.length > 0) {
    // Check for bold
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      runs.push(new TextRun({ text: boldMatch[1], bold: true, size: fontSize * 2 }));
      remaining = remaining.substring(boldMatch[0].length);
      continue;
    }
    
    // Check for italic
    const italicMatch = remaining.match(/^\*(.+?)\*/);
    if (italicMatch) {
      runs.push(new TextRun({ text: italicMatch[1], italics: true, size: fontSize * 2 }));
      remaining = remaining.substring(italicMatch[0].length);
      continue;
    }
    
    // Find next formatting marker
    const nextBold = remaining.indexOf('**');
    const nextItalic = remaining.indexOf('*');
    
    let plainEnd = remaining.length;
    if (nextBold !== -1 && nextBold < plainEnd) plainEnd = nextBold;
    if (nextItalic !== -1 && nextItalic < plainEnd) plainEnd = nextItalic;
    
    if (plainEnd > 0) {
      runs.push(new TextRun({ text: remaining.substring(0, plainEnd), size: fontSize * 2 }));
      remaining = remaining.substring(plainEnd);
    } else {
      // Escape single special char
      runs.push(new TextRun({ text: remaining[0], size: fontSize * 2 }));
      remaining = remaining.substring(1);
    }
  }
  
  return runs;
}

// =============================================================================
// PDF GENERATION
// =============================================================================

function generatePDF(
  document: GeneratedDocument,
  options?: ExportDocumentRequest['formatting']
): ArrayBuffer {
  const formatting = document.formatting;
  
  // Create PDF (Letter size: 8.5 x 11 inches)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter',
  });
  
  const pageWidth = 8.5;
  const pageHeight = 11;
  const marginLeft = formatting.margins.left;
  const marginRight = formatting.margins.right;
  const marginTop = formatting.margins.top;
  const marginBottom = formatting.margins.bottom;
  const contentWidth = pageWidth - marginLeft - marginRight;
  
  // Set font
  doc.setFont('times', 'normal');
  doc.setFontSize(formatting.fontSize);
  
  let y = marginTop;
  const lineHeight = formatting.lineSpacing === 'double' ? 0.4 : formatting.lineSpacing === '1.5' ? 0.3 : 0.2;
  
  const addPage = () => {
    doc.addPage();
    y = marginTop;
    if (formatting.pageNumbers) {
      doc.setFontSize(10);
      doc.text(
        `Page ${doc.getNumberOfPages()}`,
        pageWidth / 2,
        pageHeight - 0.5,
        { align: 'center' }
      );
      doc.setFontSize(formatting.fontSize);
    }
  };
  
  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - marginBottom) {
      addPage();
    }
  };
  
  const addText = (text: string, options?: { bold?: boolean; italic?: boolean; size?: number; indent?: number }) => {
    const fontSize = options?.size || formatting.fontSize;
    const indent = options?.indent || 0;
    
    doc.setFontSize(fontSize);
    if (options?.bold && options?.italic) {
      doc.setFont('times', 'bolditalic');
    } else if (options?.bold) {
      doc.setFont('times', 'bold');
    } else if (options?.italic) {
      doc.setFont('times', 'italic');
    } else {
      doc.setFont('times', 'normal');
    }
    
    // Word wrap
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    
    for (const line of lines) {
      checkPageBreak(lineHeight);
      doc.text(line, marginLeft + indent, y);
      y += lineHeight;
    }
  };
  
  // Process each section
  for (const section of document.sections) {
    // Add section title (except for Header/Letterhead)
    if (section.sectionName !== 'Header' && section.sectionName !== 'Letterhead') {
      checkPageBreak(0.5);
      y += 0.2; // Space before heading
      addText(section.sectionName.toUpperCase(), { bold: true, size: 13 });
      y += 0.1;
    }
    
    // Parse and add content
    const lines = section.content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed === '') {
        y += lineHeight / 2;
        continue;
      }
      
      // Handle headers
      if (trimmed.startsWith('### ')) {
        y += 0.1;
        addText(trimmed.substring(4), { bold: true, size: 11 });
        continue;
      }
      if (trimmed.startsWith('## ')) {
        y += 0.15;
        addText(trimmed.substring(3), { bold: true, size: 12 });
        continue;
      }
      if (trimmed.startsWith('# ')) {
        y += 0.2;
        addText(trimmed.substring(2), { bold: true, size: 14 });
        continue;
      }
      
      // Handle horizontal rule
      if (trimmed === '---') {
        checkPageBreak(0.3);
        doc.setLineWidth(0.01);
        doc.line(marginLeft, y, pageWidth - marginRight, y);
        y += 0.2;
        continue;
      }
      
      // Regular text (strip markdown formatting for PDF)
      const plainText = trimmed
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/\[(.+?)\]\(.+?\)/g, '$1');
      
      addText(plainText, { indent: 0.5 });
    }
    
    y += 0.2; // Space after section
  }
  
  // Add page numbers to all pages
  if (formatting.pageNumbers) {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setFont('times', 'normal');
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 0.5,
        { align: 'center' }
      );
    }
  }
  
  // Return as ArrayBuffer
  return doc.output('arraybuffer');
}

// =============================================================================
// HTML GENERATION (Fallback)
// =============================================================================

function generateExportHTML(
  document: GeneratedDocument,
  options?: ExportDocumentRequest['formatting']
): string {
  const formatting = document.formatting;

  const css = `
    @page {
      margin: ${formatting.margins.top}in ${formatting.margins.right}in ${formatting.margins.bottom}in ${formatting.margins.left}in;
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
    h1, h2, h3 { margin-top: 1em; margin-bottom: 0.5em; }
    p { text-indent: 0.5in; margin-bottom: 0.5em; }
    .section { margin-bottom: 1.5em; }
    @media print { body { padding: 0; } }
  `;

  let content = '';
  for (const section of document.sections) {
    content += `<div class="section">`;
    if (section.sectionName !== 'Header' && section.sectionName !== 'Letterhead') {
      content += `<h2>${section.sectionName}</h2>`;
    }
    content += `<div>${convertMarkdownToHTML(section.content)}</div></div>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${document.templateName}</title><style>${css}</style></head><body>${content}</body></html>`;
}

function convertMarkdownToHTML(markdown: string): string {
  let html = markdown;
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/^---$/gm, '<hr>');
  html = html.split('\n\n').map(p => p.trim() ? `<p>${p.replace(/\n/g, ' ')}</p>` : '').join('\n');
  return html;
}
