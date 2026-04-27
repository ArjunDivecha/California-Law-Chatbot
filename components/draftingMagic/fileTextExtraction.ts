export interface FileTextExtractionResult {
  text: string;
  format: string;
  warning?: string;
}

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

export const extractTextFromFile = async (file: File): Promise<FileTextExtractionResult> => {
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
    return {
      text,
      format: 'PDF',
      warning: text ? undefined : 'No selectable text was extracted. This may be a scanned PDF.',
    };
  }

  return {
    text: '',
    format: extension ? extension.toUpperCase() : 'File',
    warning: 'This file type is not yet supported for local extraction.',
  };
};
