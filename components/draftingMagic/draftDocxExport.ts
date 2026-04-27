interface DraftDocxSection {
  title: string;
  status: string;
  lineage: string;
  requirements: string;
  content: string;
}

interface DraftDocxChecklistItem {
  requirement: string;
  location: string;
  status: string;
  evidence: string;
}

interface DraftDocxSource {
  name: string;
  role: string;
  included: boolean;
  base: boolean;
  format: string;
  status: string;
}

interface DraftDocxComparisonRow {
  issue: string;
  recommendation: string;
  confidence: string;
  approved: boolean;
  rationale: string;
  newLawImpact: string;
}

interface DraftDocxStrategy {
  outputType: string;
  baseStrategy: string;
  tone: string;
  citations: string;
}

interface DraftDocxExportInput {
  sections: DraftDocxSection[];
  checklist: DraftDocxChecklistItem[];
  sources: DraftDocxSource[];
  rows: DraftDocxComparisonRow[];
  strategy: DraftDocxStrategy;
  attorneyUpdate: string;
  generatedAt?: string | null;
  draftReady: boolean;
  sanitizationMethod?: string | null;
}

const localOnlyNotice =
  'This DOCX is generated in the browser from the rehydrated attorney preview. The cloud drafter receives tokenized packet text only; do not upload this exported document externally without attorney review.';

const clean = (value: string | null | undefined) => (value || '').replace(/\s+/g, ' ').trim();
type DocxModule = typeof import('docx');

const paragraph = (docx: DocxModule, text: string, options: Record<string, unknown> = {}) =>
  new docx.Paragraph({
    spacing: { after: 160 },
    children: [new docx.TextRun({ text: clean(text) || ' ', size: 22 })],
    ...options,
  });

const heading = (docx: DocxModule, text: string, level = docx.HeadingLevel.HEADING_2) =>
  new docx.Paragraph({
    text: clean(text),
    heading: level,
    spacing: { before: 260, after: 120 },
  });

const keyValue = (docx: DocxModule, label: string, value: string) =>
  new docx.Paragraph({
    spacing: { after: 90 },
    children: [
      new docx.TextRun({ text: `${label}: `, bold: true, size: 20 }),
      new docx.TextRun({ text: clean(value) || 'Not specified', size: 20 }),
    ],
  });

const separator = (docx: DocxModule) =>
  new docx.Paragraph({
    border: {
      bottom: {
        color: 'D1D5DB',
        space: 1,
        style: 'single',
        size: 6,
      },
    },
    spacing: { before: 120, after: 120 },
  });

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const buildDraftPackageDocument = ({
  sections,
  checklist,
  sources,
  rows,
  strategy,
  attorneyUpdate,
  generatedAt,
  draftReady,
  sanitizationMethod,
}: DraftDocxExportInput, docx: DocxModule) => {
  const generatedDate = generatedAt ? new Date(generatedAt) : new Date();
  const includedSources = sources.filter((source) => source.included);
  const openRows = rows.filter((row) => !row.approved);

  return new docx.Document({
    title: 'Drafting Magic Estate Packet Draft',
    creator: 'Drafting Magic',
    description: 'Browser-side export of the rehydrated Drafting Magic draft package.',
    sections: [
      {
        properties: {},
        children: [
          new docx.Paragraph({
            text: 'Drafting Magic Estate Packet Draft',
            heading: docx.HeadingLevel.TITLE,
            alignment: docx.AlignmentType.CENTER,
            spacing: { after: 120 },
          }),
          paragraph(docx, `Generated ${generatedDate.toLocaleString()}`, {
            alignment: docx.AlignmentType.CENTER,
          }),
          paragraph(docx, localOnlyNotice, {
            spacing: { before: 120, after: 180 },
          }),
          separator(docx),

          heading(docx, 'Draft Posture'),
          keyValue(docx, 'Output type', strategy.outputType),
          keyValue(docx, 'Base strategy', strategy.baseStrategy),
          keyValue(docx, 'Tone', strategy.tone),
          keyValue(docx, 'Review posture', strategy.citations),
          keyValue(docx, 'Draft status', draftReady ? 'Current' : 'Needs regeneration'),
          keyValue(docx, 'Sanitization method', sanitizationMethod ? sanitizationMethod.toUpperCase() : 'Not recorded'),
          paragraph(docx, attorneyUpdate),

          heading(docx, 'Draft Sections'),
          ...sections.flatMap((section, index) => [
            heading(docx, `${index + 1}. ${section.title}`, docx.HeadingLevel.HEADING_3),
            keyValue(docx, 'Status', section.status),
            keyValue(docx, 'Lineage', section.lineage),
            keyValue(docx, 'Requirements', section.requirements),
            paragraph(docx, section.content),
          ]),

          heading(docx, 'Attorney Review Checklist'),
          ...checklist.flatMap((item, index) => [
            heading(docx, `${index + 1}. ${item.requirement}`, docx.HeadingLevel.HEADING_3),
            keyValue(docx, 'Status', item.status),
            keyValue(docx, 'Draft location', item.location),
            paragraph(docx, item.evidence),
          ]),

          heading(docx, 'Source Lineage'),
          ...includedSources.map((source, index) =>
            keyValue(
              docx,
              `${index + 1}. ${source.role}`,
              `${source.name} (${source.format}, ${source.base ? 'base document' : 'supporting document'}, ${source.status})`
            )
          ),

          heading(docx, 'Decision Matrix Summary'),
          ...rows.map((row, index) =>
            paragraph(
              docx,
              `${index + 1}. ${row.issue} - ${row.recommendation} (${row.confidence}, ${
                row.approved ? 'approved' : 'open'
              }). ${row.newLawImpact} ${row.rationale}`
            )
          ),
          paragraph(
            docx,
            openRows.length
              ? `Open attorney decisions remaining: ${openRows.map((row) => row.issue).join('; ')}.`
              : 'All matrix recommendations are marked approved.'
          ),
        ],
      },
    ],
  });
};

export const downloadDraftPackageDocx = async (input: DraftDocxExportInput) => {
  const docx = await import('docx');
  const { Packer } = docx;
  const document = buildDraftPackageDocument(input, docx);
  const blob = await Packer.toBlob(document);
  const dateStamp = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `drafting-magic-draft-${dateStamp}.docx`);
};
