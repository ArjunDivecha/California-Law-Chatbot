type RowRecommendation = 'Keep' | 'Revise' | 'Discard' | 'Add' | 'Review';

interface SourceForDrafting {
  role: string;
  name: string;
  included: boolean;
}

interface RowForDrafting {
  id: string;
  issue: string;
  rowType: string;
  sourceALabel: string;
  sourceA: string;
  sourceBLabel: string;
  sourceB: string;
  sourceCLabel: string;
  sourceC: string;
  newLawImpact: string;
  recommendation: RowRecommendation;
  rationale: string;
  confidence: 'High' | 'Medium' | 'Low';
  approved: boolean;
}

interface StrategyForDrafting {
  outputType: string;
  baseStrategy: string;
  tone: string;
  citations: string;
}

export interface GeneratedDraftSection {
  id: string;
  title: string;
  status: 'Reviewed' | 'Needs review' | 'Generated';
  lineage: string;
  requirements: string;
  content: string;
}

export interface GeneratedComplianceItem {
  id: string;
  requirement: string;
  location: string;
  status: 'Satisfied' | 'Partial' | 'Needs review';
  evidence: string;
}

export interface GeneratedDraftPackage {
  sections: GeneratedDraftSection[];
  checklist: GeneratedComplianceItem[];
}

const sentence = (value: string) => value.trim().replace(/\s+/g, ' ');

const listRows = (rows: RowForDrafting[]) =>
  rows.length
    ? rows
        .map(
          (row) =>
            `${row.issue}: ${row.recommendation.toLowerCase()} because ${sentence(row.rationale)} Source basis: ${sourceSummaryFor(row)}`
        )
        .join(' ')
    : 'No comparison rows have been approved yet.';

const sourceLineage = (sources: SourceForDrafting[]) =>
  sources
    .filter((source) => source.included)
    .map((source) => source.role)
    .join(', ') || 'No included sources';

const locationFor = (row: RowForDrafting) => {
  if (/property|prenup|waiver|funding/i.test(row.issue)) return 'Property and Prenup Guardrails';
  if (/health|privacy|agent|fiduciary|incapacity/i.test(row.issue)) return 'Fiduciary and Agent Authority';
  if (/pour-over|residuary|trust identity/i.test(row.issue)) return 'Trust and Pour-over Alignment';
  return 'Estate Plan Review Memo';
};

const draftingSentenceFor = (row: RowForDrafting) => {
  const sourceSummary = sourceSummaryFor(row);

  if (row.recommendation === 'Discard') {
    return `${row.issue}: do not carry forward conflicting language. ${row.rationale}`;
  }

  if (row.recommendation === 'Add') {
    return `${row.issue}: add a new review paragraph addressing this gap. ${row.rationale}`;
  }

  if (row.recommendation === 'Keep') {
    return `${row.issue}: preserve the existing structure while normalizing references across the packet. ${sourceSummary}`;
  }

  return `${row.issue}: revise the draft language to reflect the packet evidence. ${sourceSummary} ${row.rationale}`;
};

const sourceSummaryFor = (row: RowForDrafting) =>
  [row.sourceA, row.sourceB, row.sourceC]
    .map(sentence)
    .filter((value) => value && !value.startsWith('Not included'))
    .slice(0, 3)
    .join(' ');

export const generateDraftPackage = ({
  attorneyUpdate,
  rows,
  sources,
  strategy,
}: {
  attorneyUpdate: string;
  rows: RowForDrafting[];
  sources: SourceForDrafting[];
  strategy: StrategyForDrafting;
}): GeneratedDraftPackage => {
  const approvedRows = rows.filter((row) => row.approved);
  const openRows = rows.filter((row) => !row.approved);
  const includedSources = sources.filter((source) => source.included);
  const lineage = sourceLineage(sources);

  const sections: GeneratedDraftSection[] = [
    {
      id: 'generated-executive-summary',
      title: 'Estate Plan Review Memo',
      status: 'Generated',
      lineage,
      requirements: `${strategy.outputType}, ${strategy.baseStrategy}, ${strategy.citations}`,
      content: `This ${strategy.outputType.toLowerCase()} reconciles ${includedSources.length} estate-planning documents using a ${strategy.baseStrategy.toLowerCase()} posture. The current attorney instruction is: ${sentence(attorneyUpdate)} The draft applies approved comparison decisions first and keeps unresolved items visible for attorney review before export.`,
    },
    {
      id: 'generated-packet-language',
      title: 'Proposed Packet Language',
      status: approvedRows.length ? 'Generated' : 'Needs review',
      lineage: approvedRows.map((row) => `${row.sourceALabel}/${row.sourceBLabel}/${row.sourceCLabel}`).join(', ') || lineage,
      requirements: 'Source-derived drafting text',
      content: approvedRows.length
        ? approvedRows.map(draftingSentenceFor).join(' ')
        : 'Approve at least one comparison row before treating the generated drafting language as ready for review.',
    },
    {
      id: 'generated-approved-plan',
      title: 'Approved Drafting Plan',
      status: approvedRows.length ? 'Generated' : 'Needs review',
      lineage: approvedRows.map((row) => row.issue).join(', ') || lineage,
      requirements: `${approvedRows.length} approved matrix decisions`,
      content: listRows(approvedRows),
    },
    {
      id: 'generated-review-flags',
      title: 'Attorney Review Flags',
      status: openRows.length ? 'Needs review' : 'Reviewed',
      lineage: openRows.map((row) => row.issue).join(', ') || lineage,
      requirements: `${openRows.length} unresolved decision${openRows.length === 1 ? '' : 's'}`,
      content: openRows.length
        ? openRows
            .map((row) => `${row.issue}: ${row.newLawImpact} Attorney decision needed because ${sentence(row.rationale)}`)
            .join(' ')
        : 'All current comparison rows have been approved. Final attorney review is still required before export.',
    },
  ];

  const checklist: GeneratedComplianceItem[] = [
    {
      id: 'generated-packet-complete',
      requirement: 'All included estate-planning documents are represented in the draft package',
      location: 'Estate Plan Review Memo',
      status: includedSources.length === sources.length ? 'Satisfied' : 'Partial',
      evidence: `${includedSources.length} of ${sources.length} packet documents are included: ${lineage}.`,
    },
    ...rows.map((row) => ({
      id: `generated-${row.id}`,
      requirement: row.issue,
      location: locationFor(row),
      status: row.approved ? 'Satisfied' : 'Needs review',
      evidence: row.approved
        ? `Approved ${row.recommendation.toLowerCase()} decision. ${row.rationale}`
        : `Open ${row.recommendation.toLowerCase()} decision. ${row.newLawImpact}`,
    })),
  ];

  return { sections, checklist };
};
