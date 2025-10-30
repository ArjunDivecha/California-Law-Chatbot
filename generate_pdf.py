#!/usr/bin/env python3
"""
Convert COMPREHENSIVE_GUIDE.md to a beautiful PDF using WeasyPrint

INPUT FILES:
- COMPREHENSIVE_GUIDE.md (markdown source)

OUTPUT FILES:
- COMPREHENSIVE_GUIDE.pdf (beautiful formatted PDF)

Dependencies:
- markdown (python library)
- weasyprint (for PDF generation)

Version: 1.0
Last Updated: October 30, 2025
"""

import markdown
from weasyprint import HTML, CSS
from pathlib import Path
import sys
import re

def generate_pdf():
    """Convert markdown to beautiful PDF using WeasyPrint"""
    
    # File paths
    md_file = Path("COMPREHENSIVE_GUIDE.md")
    pdf_file = Path("COMPREHENSIVE_GUIDE.pdf")
    
    if not md_file.exists():
        print(f"❌ Error: {md_file} not found!")
        sys.exit(1)
    
    print(f"📄 Reading {md_file}...")
    
    # Read markdown
    with open(md_file, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    # Convert markdown to HTML
    print("🔄 Converting markdown to HTML...")
    html_content = markdown.markdown(
        md_content,
        extensions=['extra', 'tables', 'codehilite', 'toc']
    )
    
    # Post-process HTML to add page break before User Guide section
    # Find the User Guide heading and add page-break-before style
    html_content = re.sub(
        r'(<h2[^>]*>User Guide</h2>)',
        r'<div style="page-break-before: always;"></div>\1',
        html_content,
        flags=re.IGNORECASE
    )
    
    # Beautiful CSS styling with improved pagination
    css_styles = """
    @page {
        size: letter;
        margin: 2.5cm 2cm;
        @top-center {
            content: "California Law Chatbot - Comprehensive Guide";
            font-size: 9pt;
            color: #666;
        }
        @bottom-center {
            content: "Page " counter(page);
            font-size: 9pt;
            color: #666;
        }
    }
    
    @page :first {
        @top-center {
            content: "";
        }
        @bottom-center {
            content: "";
        }
    }
    
    body {
        font-family: 'Georgia', 'Times New Roman', serif;
        font-size: 11pt;
        line-height: 1.6;
        color: #333;
        max-width: 100%;
        orphans: 3;
        widows: 3;
    }
    
    h1 {
        font-size: 24pt;
        color: #1a5490;
        border-bottom: 3px solid #1a5490;
        padding-bottom: 10px;
        margin-top: 30px;
        margin-bottom: 20px;
        page-break-after: avoid;
        page-break-inside: avoid;
        orphans: 3;
        widows: 3;
    }
    
    h2 {
        font-size: 18pt;
        color: #2c5f8d;
        border-bottom: 2px solid #2c5f8d;
        padding-bottom: 8px;
        margin-top: 25px;
        margin-bottom: 15px;
        page-break-after: avoid;
        page-break-inside: avoid;
        page-break-before: auto;
        orphans: 3;
        widows: 3;
    }
    
    h3 {
        font-size: 14pt;
        color: #3d6fa8;
        margin-top: 20px;
        margin-bottom: 12px;
        page-break-after: avoid;
        page-break-inside: avoid;
        orphans: 3;
        widows: 3;
    }
    
    h4 {
        font-size: 12pt;
        color: #4d7fb8;
        margin-top: 15px;
        margin-bottom: 10px;
        font-weight: bold;
        page-break-after: avoid;
        orphans: 3;
        widows: 3;
    }
    
    p {
        margin-bottom: 12px;
        text-align: justify;
        orphans: 3;
        widows: 3;
    }
    
    code {
        font-family: 'Courier New', monospace;
        background-color: #f5f5f5;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 10pt;
    }
    
    pre {
        background-color: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 5px;
        padding: 15px;
        overflow-x: auto;
        page-break-inside: avoid;
        page-break-before: auto;
        page-break-after: auto;
        font-size: 10pt;
        orphans: 3;
        widows: 3;
    }
    
    pre code {
        background-color: transparent;
        padding: 0;
    }
    
    blockquote {
        border-left: 4px solid #1a5490;
        padding-left: 20px;
        margin-left: 0;
        color: #555;
        font-style: italic;
        page-break-inside: avoid;
        orphans: 3;
        widows: 3;
    }
    
    /* Ensure sections don't break awkwardly */
    section, div {
        orphans: 3;
        widows: 3;
    }
    
    /* Keep related content together */
    h2 + p, h2 + ul, h2 + ol {
        page-break-before: avoid;
    }
    
    h3 + p, h3 + ul, h3 + ol {
        page-break-before: avoid;
    }
    
    table {
        border-collapse: collapse;
        width: 100%;
        margin: 20px 0;
        page-break-inside: avoid;
        orphans: 3;
        widows: 3;
    }
    
    thead {
        display: table-header-group;
    }
    
    tfoot {
        display: table-footer-group;
    }
    
    tr {
        page-break-inside: avoid;
        page-break-after: auto;
    }
    
    th {
        background-color: #1a5490;
        color: white;
        padding: 10px;
        text-align: left;
        font-weight: bold;
        page-break-inside: avoid;
    }
    
    td {
        padding: 8px;
        border: 1px solid #ddd;
        page-break-inside: avoid;
    }
    
    tr:nth-child(even) {
        background-color: #f9f9f9;
    }
    
    ul, ol {
        margin-left: 25px;
        margin-bottom: 12px;
        orphans: 3;
        widows: 3;
    }
    
    li {
        margin-bottom: 8px;
        page-break-inside: avoid;
        orphans: 2;
        widows: 2;
    }
    
    a {
        color: #1a5490;
        text-decoration: none;
    }
    
    a:hover {
        text-decoration: underline;
    }
    
    strong {
        color: #1a5490;
        font-weight: bold;
    }
    
    em {
        color: #555;
    }
    
    hr {
        border: none;
        border-top: 2px solid #ddd;
        margin: 30px 0;
        page-break-inside: avoid;
        page-break-before: auto;
        page-break-after: auto;
    }
    
    /* Table of Contents styling */
    .toc {
        background-color: #f8f9fa;
        border: 1px solid #ddd;
        border-radius: 5px;
        padding: 20px;
        margin-bottom: 30px;
    }
    
    .toc h2 {
        border: none;
        margin-top: 0;
    }
    
    .toc ul {
        list-style-type: none;
        margin-left: 0;
    }
    
    .toc a {
        color: #1a5490;
        text-decoration: none;
    }
    
    /* Code blocks */
    .codehilite {
        background-color: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 5px;
        padding: 15px;
        overflow-x: auto;
        page-break-inside: avoid;
    }
    
    /* Warning boxes */
    :has(> strong:contains("⚠️")) {
        background-color: #fff3cd;
        border-left: 4px solid #ffc107;
        padding: 10px;
        margin: 15px 0;
    }
    
    /* Success boxes */
    :has(> strong:contains("✅")) {
        background-color: #d4edda;
        border-left: 4px solid #28a745;
        padding: 10px;
        margin: 15px 0;
    }
    
    /* Page breaks */
    .page-break {
        page-break-after: always;
    }
    """
    
    # Wrap HTML with styling
    full_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>California Law Chatbot - Comprehensive Guide</title>
        <style>{css_styles}</style>
    </head>
    <body>
        <div style="text-align: center; margin-bottom: 40px; page-break-after: always;">
            <h1 style="font-size: 32pt; border: none; margin-top: 100px;">California Law Chatbot</h1>
            <h2 style="font-size: 24pt; border: none; color: #666;">Comprehensive Guide</h2>
            <p style="font-size: 14pt; color: #888; margin-top: 30px;">October 2025</p>
        </div>
        {html_content}
    </body>
    </html>
    """
    
    # Generate PDF
    print("📄 Generating PDF...")
    try:
        HTML(string=full_html).write_pdf(
            pdf_file,
            stylesheets=[CSS(string=css_styles)]
        )
        
        file_size_kb = pdf_file.stat().st_size / 1024
        print(f"✅ Successfully created {pdf_file}")
        print(f"   File size: {file_size_kb:.1f} KB")
        print(f"   Location: {pdf_file.absolute()}")
        return True
        
    except Exception as e:
        print(f"❌ Error generating PDF: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = generate_pdf()
    sys.exit(0 if success else 1)
