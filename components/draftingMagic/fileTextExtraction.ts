export interface FileTextExtractionResult {
  text: string;
  format: string;
  warning?: string;
}

export interface FileTextExtractionOptions {
  /** Run in-browser OCR when a PDF has no text layer (default true). The
   *  Tesseract engine loads from CDN once; document content never leaves
   *  the device. */
  ocr?: boolean;
  /** Progress callback for OCR: (pagesDone, pagesTotal). */
  onOcrProgress?: (done: number, total: number) => void;
}

/** OCR is slow (~5-20s/page) — refuse silly page counts. */
const MAX_OCR_PAGES = 50;

// Render each PDF page to a canvas and OCR it with Tesseract (all local).
const ocrPdf = async (
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<{ text: string; pages: number; skipped: number }> => {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
  GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const total = Math.min(pdf.numPages, MAX_OCR_PAGES);
  const skipped = pdf.numPages - total;

  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  const pageTexts: string[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      // ~150 dpi: good OCR accuracy without huge canvases.
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas 2d context unavailable');
      await page.render({ canvasContext: ctx, viewport }).promise;
      const { data: result } = await worker.recognize(canvas);
      pageTexts.push(result.text);
      canvas.width = 0; // release bitmap memory promptly
      canvas.height = 0;
      onProgress?.(pageNumber, total);
    }
  } finally {
    await worker.terminate();
    await pdf.destroy();
  }
  return { text: normalizeText(pageTexts.join('\n\n')), pages: total, skipped };
};

const normalizeText = (text: string) =>
  text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const extensionFor = (fileName: string) => fileName.split('.').pop()?.toLowerCase() || '';

const extractTextFromPdf = async (file: File): Promise<string> => {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
  GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .filter(Boolean)
      .join(' ');
    pageTexts.push(pageText);
  }

  await pdf.destroy();
  return normalizeText(pageTexts.join('\n\n'));
};

const extractTextFromDocx = async (file: File): Promise<string> => {
  const mammothModule = await import('mammoth');
  const mammoth = mammothModule.default || mammothModule;
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return normalizeText(result.value);
};

export const extractTextFromFile = async (
  file: File,
  options?: FileTextExtractionOptions,
): Promise<FileTextExtractionResult> => {
  const extension = extensionFor(file.name);

  if (file.type.startsWith('text/') || extension === 'txt' || extension === 'md') {
    return {
      text: normalizeText(await file.text()),
      format: extension ? extension.toUpperCase() : 'TXT',
    };
  }

  if (extension === 'docx') {
    const text = await extractTextFromDocx(file);
    return {
      text,
      format: 'DOCX',
      warning: text ? undefined : 'No text was extracted from this DOCX.',
    };
  }

  if (extension === 'pdf') {
    const text = await extractTextFromPdf(file);
    if (text) {
      return { text, format: 'PDF' };
    }
    // No text layer — scanned image. OCR it locally unless disabled.
    if (options?.ocr === false) {
      return {
        text: '',
        format: 'PDF',
        warning:
          'This PDF has no text layer — it is likely a scanned image. Enable OCR or use the original document file.',
      };
    }
    const ocr = await ocrPdf(file, options?.onOcrProgress);
    if (!ocr.text) {
      return {
        text: '',
        format: 'PDF',
        warning:
          'OCR could not recover readable text from this scan. The image quality may be too low — try a cleaner copy or the original document file.',
      };
    }
    return {
      text: ocr.text,
      format: 'PDF',
      warning: `Text recovered by OCR from ${ocr.pages} scanned page${ocr.pages === 1 ? '' : 's'}${
        ocr.skipped > 0 ? ` (first ${ocr.pages} of ${ocr.pages + ocr.skipped} — the rest were skipped)` : ''
      } — review it for accuracy before relying on it.`,
    };
  }

  return {
    text: '',
    format: extension ? extension.toUpperCase() : 'File',
    warning: 'This file type is not yet supported for local extraction.',
  };
};
