import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileCheck2,
  FilePlus2,
  FileText,
  GitCompareArrows,
  Highlighter,
  Loader2,
  Lock,
  PanelRight,
  PencilLine,
  RefreshCw,
  RotateCcw,
  Scale,
  ShieldCheck,
  Sparkles,
  Upload,
  Unlock,
  Wand2,
} from 'lucide-react';
import { useSanitizer } from '../../hooks/useSanitizer';
import { getChatSanitizer, tokenizeForWire } from '../../services/sanitization/chatAdapter';
import { downloadDraftPackageDocx } from './draftDocxExport';
import {
  markSectionEdited,
  mergeGeneratedDraftSections,
  replaceDraftSectionFromGenerated,
  toggleSectionLock,
  type EditableDraftSection,
} from './draftSectionState';
import { extractTextFromFile } from './fileTextExtraction';
import type { GeneratedDraftPackage } from './localDraftGeneration';
import { buildPacketComparisonRows, extractDraftingUnits } from './localExtraction';

type WorkflowTab = 'inputs' | 'compare' | 'strategy' | 'draft' | 'review';
type SourceRole = 'Trust' | 'Pour-over will' | 'Advance directive' | 'Financial POA' | 'Prenup';
type RowRecommendation = 'Keep' | 'Revise' | 'Discard' | 'Add' | 'Review';
type SourceInputMode = 'sample' | 'uploaded' | 'pasted';
type DraftGenerationStatus = 'idle' | 'sanitizing' | 'generating';
type DraftSanitizationMethod = 'opf' | 'heuristic' | 'mixed';
type DraftExportStatus = 'idle' | 'exporting';

interface DraftingMagicSource {
  id: string;
  name: string;
  role: SourceRole;
  description: string;
  format: string;
  sections: number;
  words: string;
  included: boolean;
  base: boolean;
  status: 'Ready' | 'Needs review' | 'Extracting';
  inputMode: SourceInputMode;
  uploadedFileName?: string;
  excerpt?: string;
  warning?: string;
}

interface ComparisonRow {
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

type DraftSection = EditableDraftSection;

interface ComplianceItem {
  id: string;
  requirement: string;
  location: string;
  status: 'Satisfied' | 'Partial' | 'Needs review';
  evidence: string;
}

interface DraftingMagicStrategy {
  outputType: string;
  baseStrategy: string;
  tone: string;
  citations: string;
}

interface DraftingMagicWorkspaceSnapshot {
  version: 1;
  savedAt: string;
  activeTab: WorkflowTab;
  sources: DraftingMagicSource[];
  rows: ComparisonRow[];
  selectedRowId: string;
  activeSourceId: string;
  attorneyUpdate: string;
  analysisFresh: boolean;
  strategy: DraftingMagicStrategy;
  draftReady: boolean;
  draftSections: DraftSection[];
  complianceItems: ComplianceItem[];
  selectedSectionId: string;
}

interface SanitizedDraftingMagicPayload {
  flow: 'accuracy_client';
  attorneyUpdate: string;
  sources: Array<{
    id: string;
    name: string;
    role: SourceRole;
    included: boolean;
    base: boolean;
    text: string;
    description: string;
    format: string;
  }>;
  rows: ComparisonRow[];
  strategy: DraftingMagicStrategy;
  sanitization: {
    method: DraftSanitizationMethod;
    tokenCount: number;
  };
}

const workspaceStorageKey = 'drafting-magic:estate-workspace:v1';

const tabs: Array<{ id: WorkflowTab; label: string }> = [
  { id: 'inputs', label: 'Inputs' },
  { id: 'compare', label: 'Compare' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'draft', label: 'Draft' },
  { id: 'review', label: 'Review' },
];

const defaultAttorneyUpdate =
  'New instruction: reconcile the estate-planning packet for a married client, preserve the prenup property classifications, normalize the trust identity across the pour-over will, and flag any agent-order mismatches before drafting.';

const defaultStrategy: DraftingMagicStrategy = {
  outputType: 'Estate plan review memo',
  baseStrategy: 'Packet reconciliation',
  tone: 'Client-friendly',
  citations: 'Attorney checklist',
};

const countWords = (text: string) => {
  const count = text.trim().split(/\s+/).filter(Boolean).length;
  return count.toLocaleString();
};

const estimateSections = (text: string) => {
  const headings = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^(article|section|\d+\.|[ivx]+\.)\b/i.test(line));
  return Math.max(1, headings.length || Math.ceil(text.trim().length / 1200));
};

const getFileFormat = (fileName: string) => {
  const extension = fileName.split('.').pop();
  return extension ? extension.toUpperCase() : 'File';
};

const initialSources: DraftingMagicSource[] = [
  {
    id: 'revocable-trust',
    name: 'Revocable living trust',
    role: 'Trust',
    description: 'Base estate plan instrument, trustee powers, distribution structure, and funding schedules.',
    format: 'DOCX',
    sections: 18,
    words: '11,840',
    included: true,
    base: true,
    status: 'Ready',
    inputMode: 'sample',
  },
  {
    id: 'pour-over-will',
    name: 'Pour-over will',
    role: 'Pour-over will',
    description: 'Will residue, trust identity, executor appointments, guardianship language, and execution details.',
    format: 'PDF',
    sections: 8,
    words: '3,260',
    included: true,
    base: false,
    status: 'Ready',
    inputMode: 'sample',
  },
  {
    id: 'ahcd',
    name: 'Advance health care directive',
    role: 'Advance directive',
    description: 'Health care agent order, treatment authority, end-of-life instructions, and privacy release.',
    format: 'DOCX',
    sections: 10,
    words: '4,120',
    included: true,
    base: false,
    status: 'Needs review',
    inputMode: 'sample',
    warning: 'Agent order differs from financial POA',
  },
  {
    id: 'financial-poa',
    name: 'Durable financial power of attorney',
    role: 'Financial POA',
    description: 'Financial agent authority, gifting powers, third-party reliance language, and effective date.',
    format: 'DOCX',
    sections: 12,
    words: '5,780',
    included: true,
    base: false,
    status: 'Ready',
    inputMode: 'sample',
  },
  {
    id: 'prenup',
    name: 'Prenuptial agreement',
    role: 'Prenup',
    description: 'Separate-property classifications, spousal waivers, disclosure exhibits, and transfer limits.',
    format: 'PDF',
    sections: 15,
    words: '9,430',
    included: true,
    base: false,
    status: 'Ready',
    inputMode: 'sample',
    warning: 'Separate-property terms should constrain trust funding language',
  },
];

const initialRows: ComparisonRow[] = [
  {
    id: 'fiduciary-alignment',
    issue: 'Successor fiduciary alignment',
    rowType: 'Decision-maker conflict',
    sourceALabel: 'Trust',
    sourceA: 'Trust names Maya Chen as first successor trustee and Daniel Chen as backup.',
    sourceBLabel: 'Financial POA / AHCD',
    sourceB: 'Financial POA names Daniel as first agent; AHCD names Maya as first health care agent.',
    sourceCLabel: 'Prenup',
    sourceC: 'Prenup has no fiduciary appointments, but requires separate-property tracking before transfers.',
    newLawImpact: 'Attorney-provided update requires clear incapacity trigger and acceptance language for successor fiduciaries.',
    recommendation: 'Revise',
    rationale: 'Keep the named people, but expose the mismatch so the attorney can confirm whether financial and health care authority should intentionally diverge.',
    confidence: 'High',
    approved: true,
  },
  {
    id: 'property-characterization',
    issue: 'Separate property funding guardrails',
    rowType: 'Property characterization',
    sourceALabel: 'Trust',
    sourceA: 'Trust schedule funds community and separate assets into one revocable trust without a property-character legend.',
    sourceBLabel: 'Prenup',
    sourceB: 'Prenup preserves premarital assets, appreciation, and listed accounts as separate property unless expressly transmuted.',
    sourceCLabel: 'Pour-over will',
    sourceC: 'Will pours residue into the trust but does not restate property-character limitations.',
    newLawImpact: 'New drafting instruction: preserve prenup classifications in funding, schedules, and distribution notes.',
    recommendation: 'Revise',
    rationale: 'The trust can remain the main vehicle, but funding language should not blur separate-property treatment created by the prenup.',
    confidence: 'High',
    approved: true,
  },
  {
    id: 'pour-over-alignment',
    issue: 'Pour-over residuary alignment',
    rowType: 'Cross-document consistency',
    sourceALabel: 'Pour-over will',
    sourceA: 'Will sends residue to the trust dated March 4, 2021, including later amendments.',
    sourceBLabel: 'Trust',
    sourceB: 'Trust caption uses March 4, 2021, but amendment block references an April 2024 restatement.',
    sourceCLabel: 'Prenup',
    sourceC: 'Prenup excludes several listed separate assets from any automatic community-property presumption.',
    newLawImpact: 'New execution packet should use one trust identity across will, trust, certificates, and signing memo.',
    recommendation: 'Keep',
    rationale: 'The pour-over structure is sound; the generated packet should normalize the trust name/date and flag funding carveouts.',
    confidence: 'Medium',
    approved: true,
  },
  {
    id: 'healthcare-authority',
    issue: 'Health care authority and privacy release',
    rowType: 'Authority gap',
    sourceALabel: 'AHCD',
    sourceA: 'Directive gives broad treatment and end-of-life authority but uses older privacy-release phrasing.',
    sourceBLabel: 'Financial POA',
    sourceB: 'Financial POA authorizes insurance and benefits administration but not medical treatment decisions.',
    sourceCLabel: 'Trust',
    sourceC: 'Trust permits successor trustee to pay health expenses after incapacity.',
    newLawImpact: 'Attorney-provided update calls for modern privacy authorization and agent-access language.',
    recommendation: 'Add',
    rationale: 'Add a review item so the AHCD privacy release, insurance authority, and trustee payment authority work together without merging roles.',
    confidence: 'Medium',
    approved: false,
  },
  {
    id: 'incapacity-standard',
    issue: 'Incapacity standard',
    rowType: 'Trigger definition',
    sourceALabel: 'Trust',
    sourceA: 'Trust requires two licensed physicians or court determination before successor trustee acts.',
    sourceBLabel: 'Financial POA',
    sourceB: 'POA becomes effective immediately, with optional physician certification for third-party reliance.',
    sourceCLabel: 'AHCD',
    sourceC: 'AHCD lets the agent act when the principal cannot make health care decisions.',
    newLawImpact: 'New drafting instruction asks for consistent incapacity explanations in the client-facing summary.',
    recommendation: 'Review',
    rationale: 'The legal triggers do not need to be identical, but the attorney should explain why health, financial, and trust triggers differ.',
    confidence: 'High',
    approved: false,
  },
  {
    id: 'spousal-waivers',
    issue: 'Spousal waiver boundaries',
    rowType: 'Prenup constraint',
    sourceALabel: 'Prenup',
    sourceA: 'Prenup waives elective-share-style claims only within the agreement scope and preserves disclosure exhibits.',
    sourceBLabel: 'Trust / Will',
    sourceB: 'Estate documents include spouse as beneficiary in selected circumstances but do not cite prenup exhibits.',
    sourceCLabel: 'Financial POA',
    sourceC: 'POA grants broad gifting authority that could affect separate-property boundaries.',
    newLawImpact: 'New drafting instruction requires the estate plan to honor, not silently expand, prenup waivers.',
    recommendation: 'Review',
    rationale: 'Attorney should confirm whether gifting powers, trust distributions, and waivers remain inside the negotiated prenup boundaries.',
    confidence: 'Low',
    approved: false,
  },
];

const initialDraftSections: DraftSection[] = [
  {
    id: 'packet-summary',
    title: 'Estate Plan Packet Summary',
    status: 'Reviewed',
    lineage: 'Trust, Pour-over will, Financial POA, AHCD, Prenup',
    requirements: 'Cross-document consistency, attorney review flags',
    content:
      'This draft reconciles the trust, pour-over will, health care directive, financial power of attorney, and prenuptial agreement as one estate-planning packet. It preserves the trust as the base document while flagging fiduciary mismatches, property-character issues, and agent-authority differences for attorney review.',
  },
  {
    id: 'property-plan',
    title: 'Funding and Property Characterization',
    status: 'Generated',
    lineage: 'Revocable living trust, Prenuptial agreement, Pour-over will',
    requirements: 'Separate-property guardrails, pour-over alignment',
    content:
      'The trust funding language should carry forward the prenup classifications instead of treating all scheduled property the same way. The pour-over will can remain structurally intact, but the signing packet should use one trust identity and call out any separate-property carveouts before execution.',
  },
  {
    id: 'authority-plan',
    title: 'Fiduciary and Agent Authority',
    status: 'Needs review',
    lineage: 'Trust, Financial POA, AHCD',
    requirements: 'Incapacity standard, privacy release, agent ordering',
    content:
      'The fiduciary chart should show trustee, financial agent, and health care agent roles separately. The documents can intentionally use different triggers, but the client summary should explain those differences and flag the AHCD privacy-release update before export.',
  },
];

const initialComplianceItems: ComplianceItem[] = [
  {
    id: 'packet-complete',
    requirement: 'All five estate-planning source documents included',
    location: 'Estate Plan Packet Summary',
    status: 'Satisfied',
    evidence: 'Trust, pour-over will, AHCD, financial POA, and prenup are all represented in the source library and lineage.',
  },
  {
    id: 'property-character',
    requirement: 'Preserve prenup property-character restrictions',
    location: 'Funding and Property Characterization',
    status: 'Satisfied',
    evidence: 'Draft warns that trust funding language must not blur separate-property treatment created by the prenup.',
  },
  {
    id: 'agent-order',
    requirement: 'Resolve AHCD and financial POA agent-order mismatch',
    location: 'Fiduciary and Agent Authority',
    status: 'Needs review',
    evidence: 'AHCD and financial POA appoint different first agents. Attorney confirmation required.',
  },
  {
    id: 'incapacity',
    requirement: 'Explain different incapacity triggers across documents',
    location: 'Fiduciary and Agent Authority',
    status: 'Partial',
    evidence: 'Trust, POA, and AHCD standards are surfaced, but final wording awaits attorney approval.',
  },
];

const statusColors: Record<string, string> = {
  Ready: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Needs review': 'bg-amber-50 text-amber-700 border-amber-200',
  Extracting: 'bg-sky-50 text-sky-700 border-sky-200',
  Satisfied: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Partial: 'bg-amber-50 text-amber-700 border-amber-200',
  Reviewed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Generated: 'bg-sky-50 text-sky-700 border-sky-200',
};

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'success' | 'warn' | 'info' }) {
  const tones = {
    neutral: 'bg-gray-50 text-gray-700 border-gray-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warn: 'bg-amber-50 text-amber-700 border-amber-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold leading-none ${tones[tone]}`}>
      {children}
    </span>
  );
}

function SectionHeader({ icon, title, meta }: { icon: React.ReactNode; title: string; meta?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700">{icon}</span>
        <h2 className="truncate text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      {meta && <span className="shrink-0 text-xs text-gray-500">{meta}</span>}
    </div>
  );
}

export const DraftingMagicPage: React.FC = () => {
  const { ready: sanitizerReady, unlocked: sanitizerUnlocked, tokenCount } = useSanitizer();
  const [activeTab, setActiveTab] = useState<WorkflowTab>('inputs');
  const [sources, setSources] = useState<DraftingMagicSource[]>(initialSources);
  const [rows, setRows] = useState<ComparisonRow[]>(initialRows);
  const [selectedRowId, setSelectedRowId] = useState(initialRows[0].id);
  const [activeSourceId, setActiveSourceId] = useState(initialSources[0].id);
  const [attorneyUpdate, setAttorneyUpdate] = useState(defaultAttorneyUpdate);
  const [analysisFresh, setAnalysisFresh] = useState(true);
  const [strategy, setStrategy] = useState<DraftingMagicStrategy>(defaultStrategy);
  const [draftReady, setDraftReady] = useState(true);
  const [draftSections, setDraftSections] = useState<DraftSection[]>(initialDraftSections);
  const [complianceItems, setComplianceItems] = useState<ComplianceItem[]>(initialComplianceItems);
  const [selectedSectionId, setSelectedSectionId] = useState(initialDraftSections[0].id);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<DraftGenerationStatus>('idle');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [lastDraftedAt, setLastDraftedAt] = useState<string | null>(null);
  const [lastDraftMethod, setLastDraftMethod] = useState<DraftSanitizationMethod | null>(null);
  const [draftExportStatus, setDraftExportStatus] = useState<DraftExportStatus>('idle');
  const [draftExportError, setDraftExportError] = useState<string | null>(null);
  const [lastDocxExportedAt, setLastDocxExportedAt] = useState<string | null>(null);
  const [regeneratingSectionId, setRegeneratingSectionId] = useState<string | null>(null);

  const selectedRow = rows.find((row) => row.id === selectedRowId) || rows[0];
  const selectedSection = draftSections.find((section) => section.id === selectedSectionId) || draftSections[0] || initialDraftSections[0];
  const activeSource = sources.find((source) => source.id === activeSourceId) || sources[0];
  const activeSourceUnits = useMemo(() => extractDraftingUnits(activeSource), [activeSource]);
  const extractedUnitCount = useMemo(
    () => sources.reduce((count, source) => (source.included ? count + extractDraftingUnits(source).length : count), 0),
    [sources]
  );
  const approvedCount = rows.filter((row) => row.approved).length;
  const reviewCount = rows.length - approvedCount;
  const includedSources = sources.filter((source) => source.included);
  const packetComplete = includedSources.length === sources.length;
  const reviewNeededCount = sources.filter((source) => source.status === 'Needs review').length;
  const isGeneratingDraft = generationStatus !== 'idle';
  const isExportingDocx = draftExportStatus !== 'idle';
  const lockedSectionCount = draftSections.filter((section) => section.locked).length;
  const lastDraftedLabel = lastDraftedAt
    ? new Date(lastDraftedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;
  const lastDocxExportedLabel = lastDocxExportedAt
    ? new Date(lastDocxExportedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;
  const selectedSectionEditedLabel = selectedSection.editedAt
    ? new Date(selectedSection.editedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;

  const workflowSummary = useMemo(
    () => [
      { label: 'Packet docs', value: `${sources.filter((source) => source.included).length}/${sources.length}` },
      { label: 'Extracted units', value: extractedUnitCount.toString() },
      { label: 'Matrix rows', value: rows.length.toString() },
      { label: 'Approved', value: approvedCount.toString() },
      { label: 'Open flags', value: reviewCount.toString() },
    ],
    [approvedCount, extractedUnitCount, reviewCount, rows.length, sources]
  );

  useEffect(() => {
    try {
      const savedWorkspace = window.localStorage.getItem(workspaceStorageKey);
      if (!savedWorkspace) {
        setWorkspaceLoaded(true);
        return;
      }

      const parsed = JSON.parse(savedWorkspace) as DraftingMagicWorkspaceSnapshot;
      if (parsed.version !== 1 || !Array.isArray(parsed.sources) || !Array.isArray(parsed.rows)) {
        setWorkspaceLoaded(true);
        return;
      }

      setActiveTab(parsed.activeTab || 'inputs');
      setSources(parsed.sources);
      setRows(parsed.rows);
      setSelectedRowId(parsed.selectedRowId || parsed.rows[0]?.id || initialRows[0].id);
      setActiveSourceId(parsed.activeSourceId || parsed.sources[0]?.id || initialSources[0].id);
      setAttorneyUpdate(parsed.attorneyUpdate || defaultAttorneyUpdate);
      setAnalysisFresh(Boolean(parsed.analysisFresh));
      setStrategy(parsed.strategy || defaultStrategy);
      setDraftReady(Boolean(parsed.draftReady));
      setDraftSections(Array.isArray(parsed.draftSections) ? parsed.draftSections : initialDraftSections);
      setComplianceItems(Array.isArray(parsed.complianceItems) ? parsed.complianceItems : initialComplianceItems);
      setSelectedSectionId(parsed.selectedSectionId || initialDraftSections[0].id);
      setLastSavedAt(parsed.savedAt);
      setSaveError(null);
    } catch {
      window.localStorage.removeItem(workspaceStorageKey);
      setSaveError('Saved workspace could not be restored.');
    } finally {
      setWorkspaceLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!workspaceLoaded) {
      return;
    }

    const savedAt = new Date().toISOString();
    const snapshot: DraftingMagicWorkspaceSnapshot = {
      version: 1,
      savedAt,
      activeTab,
      sources,
      rows,
      selectedRowId,
      activeSourceId,
      attorneyUpdate,
      analysisFresh,
      strategy,
      draftReady,
      draftSections,
      complianceItems,
      selectedSectionId,
    };

    try {
      window.localStorage.setItem(workspaceStorageKey, JSON.stringify(snapshot));
      setLastSavedAt(savedAt);
      setSaveError(null);
    } catch {
      setSaveError('Local browser storage is full or blocked.');
    }
  }, [
    activeSourceId,
    activeTab,
    analysisFresh,
    attorneyUpdate,
    complianceItems,
    draftSections,
    draftReady,
    rows,
    selectedRowId,
    selectedSectionId,
    sources,
    strategy,
    workspaceLoaded,
  ]);

  const markAnalysisStale = () => {
    setAnalysisFresh(false);
    setDraftReady(false);
    setGenerationError(null);
  };

  const markDraftStale = () => {
    setDraftReady(false);
    setGenerationError(null);
  };

  const toggleSource = (sourceId: string) => {
    setSources((current) =>
      current.map((source) =>
        source.id === sourceId ? { ...source, included: !source.included, base: source.included ? false : source.base } : source
      )
    );
    setActiveSourceId(sourceId);
    markAnalysisStale();
  };

  const setBaseSource = (sourceId: string) => {
    setSources((current) =>
      current.map((source) => ({
        ...source,
        base: source.id === sourceId,
        included: source.id === sourceId ? true : source.included,
      }))
    );
    setActiveSourceId(sourceId);
    markAnalysisStale();
  };

  const handleSourcePaste = (sourceId: string, text: string) => {
    setSources((current) =>
      current.map((source) =>
        source.id === sourceId
          ? {
              ...source,
              excerpt: text,
              inputMode: text.trim() ? 'pasted' : source.inputMode,
              format: text.trim() ? 'Pasted text' : source.format,
              sections: text.trim() ? estimateSections(text) : source.sections,
              words: text.trim() ? countWords(text) : source.words,
              status: text.trim() ? 'Ready' : source.status,
              warning: text.trim() ? undefined : source.warning,
            }
          : source
      )
    );
    setActiveSourceId(sourceId);
    markAnalysisStale();
  };

  const handleSourceFile = async (sourceId: string, file?: File) => {
    if (!file) {
      return;
    }

    setSources((current) =>
      current.map((source) =>
        source.id === sourceId
          ? {
              ...source,
              uploadedFileName: file.name,
              inputMode: 'uploaded',
              format: getFileFormat(file.name),
              status: 'Extracting',
              warning: 'Reading file in this browser',
            }
          : source
      )
    );
    setActiveSourceId(sourceId);
    markAnalysisStale();

    try {
      const extracted = await extractTextFromFile(file);
      const extractedText = extracted.text.trim();

      setSources((current) =>
        current.map((source) =>
          source.id === sourceId
            ? {
                ...source,
                name: file.name.replace(/\.[^.]+$/, '') || source.name,
                format: extracted.format,
                sections: extractedText ? estimateSections(extractedText) : source.sections,
                words: extractedText ? countWords(extractedText) : source.words,
                uploadedFileName: file.name,
                excerpt: extractedText || source.excerpt,
                inputMode: 'uploaded',
                status: extractedText ? 'Ready' : 'Needs review',
                warning: extracted.warning,
              }
            : source
        )
      );
    } catch (error) {
      setSources((current) =>
        current.map((source) =>
          source.id === sourceId
            ? {
                ...source,
                uploadedFileName: file.name,
                inputMode: 'uploaded',
                format: getFileFormat(file.name),
                status: 'Needs review',
                warning: error instanceof Error ? error.message : 'Could not extract text from this file.',
              }
            : source
        )
      );
    }
  };

  const toggleApproval = (rowId: string) => {
    setRows((current) => current.map((row) => (row.id === rowId ? { ...row, approved: !row.approved } : row)));
    markDraftStale();
  };

  const setRecommendation = (rowId: string, recommendation: RowRecommendation) => {
    setRows((current) => current.map((row) => (row.id === rowId ? { ...row, recommendation } : row)));
    markDraftStale();
  };

  const generateComparison = () => {
    const nextRows = buildPacketComparisonRows(sources, attorneyUpdate);
    setRows(nextRows);
    setSelectedRowId(nextRows[0]?.id || initialRows[0].id);
    setAnalysisFresh(true);
    setDraftReady(false);
    setActiveTab('compare');
  };

  const buildSanitizedPayload = async (): Promise<SanitizedDraftingMagicPayload> => {
    const rawFields: string[] = [];
    const addField = (value: string): number => {
      rawFields.push(value || '');
      return rawFields.length - 1;
    };

    const attorneyUpdateIdx = addField(attorneyUpdate);
    const strategyIndexes = {
      outputType: addField(strategy.outputType),
      baseStrategy: addField(strategy.baseStrategy),
      tone: addField(strategy.tone),
      citations: addField(strategy.citations),
    };
    const sourceIndexes = sources.map((source) => ({
      name: addField(source.name),
      text: addField(source.excerpt?.trim() || source.description),
      description: addField(source.description),
    }));
    const rowIndexes = rows.map((row) => ({
      issue: addField(row.issue),
      rowType: addField(row.rowType),
      sourceALabel: addField(row.sourceALabel),
      sourceA: addField(row.sourceA),
      sourceBLabel: addField(row.sourceBLabel),
      sourceB: addField(row.sourceB),
      sourceCLabel: addField(row.sourceCLabel),
      sourceC: addField(row.sourceC),
      newLawImpact: addField(row.newLawImpact),
      rationale: addField(row.rationale),
    }));

    const markers = rawFields.map((_, index) => `@@DM_FIELD_${String(index).padStart(4, '0')}@@`);
    const combined = rawFields.map((value, index) => `${markers[index]}\n${value}`).join('\n');
    const tokenizedPacket = await tokenizeForWire(combined);
    const sanitizedFields = rawFields.map((value, index) => {
      const marker = markers[index];
      const start = tokenizedPacket.sanitized.indexOf(marker);
      if (start === -1) return value;
      const contentStart = start + marker.length;
      const nextMarker = markers[index + 1];
      const nextStart = nextMarker ? tokenizedPacket.sanitized.indexOf(nextMarker, contentStart) : -1;
      const rawChunk = tokenizedPacket.sanitized.slice(contentStart, nextStart === -1 ? undefined : nextStart);
      return rawChunk.replace(/^\n/, '').replace(/\n$/, '');
    });

    const sanitizedAttorneyUpdate = sanitizedFields[attorneyUpdateIdx];
    const sanitizedStrategy: DraftingMagicStrategy = {
      outputType: sanitizedFields[strategyIndexes.outputType],
      baseStrategy: sanitizedFields[strategyIndexes.baseStrategy],
      tone: sanitizedFields[strategyIndexes.tone],
      citations: sanitizedFields[strategyIndexes.citations],
    };

    const sanitizedSources: SanitizedDraftingMagicPayload['sources'] = [];
    for (const [index, source] of sources.entries()) {
      const fieldIndexes = sourceIndexes[index];
      sanitizedSources.push({
        id: source.id,
        name: sanitizedFields[fieldIndexes.name],
        role: source.role,
        included: source.included,
        base: source.base,
        text: sanitizedFields[fieldIndexes.text],
        description: sanitizedFields[fieldIndexes.description],
        format: source.format,
      });
    }

    const sanitizedRows: ComparisonRow[] = [];
    for (const [index, row] of rows.entries()) {
      const fieldIndexes = rowIndexes[index];
      sanitizedRows.push({
        ...row,
        issue: sanitizedFields[fieldIndexes.issue],
        rowType: sanitizedFields[fieldIndexes.rowType],
        sourceALabel: sanitizedFields[fieldIndexes.sourceALabel],
        sourceA: sanitizedFields[fieldIndexes.sourceA],
        sourceBLabel: sanitizedFields[fieldIndexes.sourceBLabel],
        sourceB: sanitizedFields[fieldIndexes.sourceB],
        sourceCLabel: sanitizedFields[fieldIndexes.sourceCLabel],
        sourceC: sanitizedFields[fieldIndexes.sourceC],
        newLawImpact: sanitizedFields[fieldIndexes.newLawImpact],
        rationale: sanitizedFields[fieldIndexes.rationale],
      });
    }

    const method: DraftSanitizationMethod = tokenizedPacket.usedOpf ? 'opf' : 'heuristic';

    return {
      flow: 'accuracy_client',
      attorneyUpdate: sanitizedAttorneyUpdate,
      sources: sanitizedSources,
      rows: sanitizedRows,
      strategy: sanitizedStrategy,
      sanitization: {
        method,
        tokenCount,
      },
    };
  };

  const rehydrateDraftPackage = (draftPackage: GeneratedDraftPackage): GeneratedDraftPackage => {
    const sanitizer = getChatSanitizer();
    return {
      sections: draftPackage.sections.map((section) => ({
        ...section,
        title: sanitizer.rehydrateMessage(section.title),
        lineage: sanitizer.rehydrateMessage(section.lineage),
        requirements: sanitizer.rehydrateMessage(section.requirements),
        content: sanitizer.rehydrateMessage(section.content),
      })),
      checklist: draftPackage.checklist.map((item) => ({
        ...item,
        requirement: sanitizer.rehydrateMessage(item.requirement),
        location: sanitizer.rehydrateMessage(item.location),
        evidence: sanitizer.rehydrateMessage(item.evidence),
      })),
    };
  };

  const editDraftSection = (sectionId: string, patch: Partial<Pick<DraftSection, 'title' | 'content'>>) => {
    setDraftSections((current) => markSectionEdited(current, sectionId, patch));
    setSelectedSectionId(sectionId);
    setDraftExportError(null);
  };

  const toggleDraftSectionLock = (sectionId: string) => {
    setDraftSections((current) => toggleSectionLock(current, sectionId));
    setSelectedSectionId(sectionId);
  };

  const generateDraft = async () => {
    if (!sanitizerReady || !sanitizerUnlocked) {
      setGenerationError('Sanitization is not ready on this device yet. Wait for the banner to unlock before generating a cloud draft.');
      setActiveTab('draft');
      return;
    }

    setGenerationError(null);
    setGenerationStatus('sanitizing');
    setDraftReady(false);
    setActiveTab('draft');

    try {
      const payload = await buildSanitizedPayload();
      setLastDraftMethod(payload.sanitization.method);
      setGenerationStatus('generating');

      const response = await fetch('/api/drafting-magic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || `Drafting Magic API failed with status ${response.status}.`);
      }
      if (!data?.draftPackage) {
        throw new Error('Drafting Magic returned an empty draft package.');
      }

      const rehydrated = rehydrateDraftPackage(data.draftPackage as GeneratedDraftPackage);
      const mergedSections = mergeGeneratedDraftSections(draftSections, rehydrated.sections);
      setDraftSections(mergedSections);
      setComplianceItems(rehydrated.checklist);
      setSelectedSectionId(mergedSections[0]?.id || initialDraftSections[0].id);
      setDraftReady(true);
      setLastDraftedAt(new Date().toISOString());
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Drafting Magic failed.');
    } finally {
      setGenerationStatus('idle');
    }
  };

  const regenerateDraftSection = async (sectionId: string) => {
    const targetSection = draftSections.find((section) => section.id === sectionId);
    if (!targetSection) {
      return;
    }
    if (targetSection.locked) {
      setGenerationError('Unlock this section before regenerating it.');
      setActiveTab('draft');
      return;
    }
    if (!sanitizerReady || !sanitizerUnlocked) {
      setGenerationError('Sanitization is not ready on this device yet. Wait for the banner to unlock before regenerating a section.');
      setActiveTab('draft');
      return;
    }

    setGenerationError(null);
    setRegeneratingSectionId(sectionId);
    setGenerationStatus('sanitizing');
    setActiveTab('draft');

    try {
      const payload = await buildSanitizedPayload();
      setLastDraftMethod(payload.sanitization.method);
      setGenerationStatus('generating');

      const response = await fetch('/api/drafting-magic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || `Drafting Magic API failed with status ${response.status}.`);
      }
      if (!data?.draftPackage) {
        throw new Error('Drafting Magic returned an empty draft package.');
      }

      const rehydrated = rehydrateDraftPackage(data.draftPackage as GeneratedDraftPackage);
      setDraftSections((current) => replaceDraftSectionFromGenerated(current, rehydrated.sections, sectionId));
      setComplianceItems(rehydrated.checklist);
      setSelectedSectionId(sectionId);
      setLastDraftedAt(new Date().toISOString());
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Drafting Magic section regeneration failed.');
    } finally {
      setGenerationStatus('idle');
      setRegeneratingSectionId(null);
    }
  };

  const resetWorkspace = () => {
    if (!window.confirm('Clear the local Drafting Magic workspace?')) {
      return;
    }

    window.localStorage.removeItem(workspaceStorageKey);
    setActiveTab('inputs');
    setSources(initialSources);
    setRows(initialRows);
    setSelectedRowId(initialRows[0].id);
    setActiveSourceId(initialSources[0].id);
    setAttorneyUpdate(defaultAttorneyUpdate);
    setAnalysisFresh(true);
    setStrategy(defaultStrategy);
    setDraftReady(true);
    setDraftSections(initialDraftSections);
    setComplianceItems(initialComplianceItems);
    setSelectedSectionId(initialDraftSections[0].id);
    setSaveError(null);
  };

  const exportWorkspace = () => {
    const snapshot: DraftingMagicWorkspaceSnapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      activeTab,
      sources,
      rows,
      selectedRowId,
      activeSourceId,
      attorneyUpdate,
      analysisFresh,
      strategy,
      draftReady,
      draftSections,
      complianceItems,
      selectedSectionId,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `drafting-magic-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportDraftDocx = async () => {
    setDraftExportError(null);
    setDraftExportStatus('exporting');

    try {
      await downloadDraftPackageDocx({
        sections: draftSections,
        checklist: complianceItems,
        sources,
        rows,
        strategy,
        attorneyUpdate,
        generatedAt: lastDraftedAt,
        draftReady,
        sanitizationMethod: lastDraftMethod,
      });
      setLastDocxExportedAt(new Date().toISOString());
    } catch (error) {
      setDraftExportError(error instanceof Error ? error.message : 'Could not export the DOCX draft.');
    } finally {
      setDraftExportStatus('idle');
    }
  };

  const lastSavedLabel = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'Not saved yet';

  return (
    <div className="min-h-full overflow-y-auto bg-[#f7f6f2] text-gray-900 lg:h-full lg:overflow-hidden">
      <div className="flex min-h-full flex-col lg:h-full lg:min-h-0">
        <div className="border-b border-gray-200 bg-white px-5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-normal text-gray-950">Drafting Magic</h1>
                <Badge tone="success">Workbench prototype</Badge>
                <Badge tone="info">5 document estate packet</Badge>
              </div>
              <p className="mt-1 max-w-3xl text-sm text-gray-600">
                Compare trusts, pour-over wills, directives, financial powers of attorney, and prenups before generating a traceable new draft.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {workflowSummary.map((item) => (
                <div key={item.label} className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-right">
                  <div className="text-[11px] font-medium text-gray-500">{item.label}</div>
                  <div className="text-sm font-semibold text-gray-950">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-gray-600">
              <span className="inline-flex items-center gap-1 font-semibold text-gray-800">
                <Lock size={14} />
                Browser workspace
              </span>
              <Badge tone={saveError ? 'warn' : 'success'}>{saveError || `Saved locally ${lastSavedLabel}`}</Badge>
              <span className="text-gray-500">Cloud drafting receives tokenized packet text; rehydration stays in this browser.</span>
              {lastDraftedLabel && <Badge tone="info">Cloud draft {lastDraftedLabel}</Badge>}
              {lastDraftMethod && <Badge tone={lastDraftMethod === 'opf' ? 'success' : 'warn'}>{lastDraftMethod.toUpperCase()} sanitized</Badge>}
              {lastDocxExportedLabel && <Badge tone="success">DOCX exported {lastDocxExportedLabel}</Badge>}
              {lockedSectionCount > 0 && <Badge tone="info">{lockedSectionCount} locked section{lockedSectionCount === 1 ? '' : 's'}</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={exportWorkspace}
                className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Download size={14} />
                Export workspace
              </button>
              <button
                type="button"
                onClick={resetWorkspace}
                className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <RotateCcw size={14} />
                Reset
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === tab.id ? 'bg-gray-950 text-white shadow-sm' : 'text-gray-600 hover:bg-white hover:text-gray-950'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid flex-none grid-cols-1 gap-0 overflow-visible lg:min-h-0 lg:flex-1 lg:grid-cols-[288px_minmax(0,1fr)_380px] lg:overflow-hidden">
          <aside className="order-2 overflow-visible border-r border-gray-200 bg-white lg:order-none lg:min-h-0 lg:overflow-y-auto">
            <SectionHeader icon={<FileText size={15} />} title="Source Library" meta={`${sources.length} items`} />
            <div className="space-y-3 p-3">
              <button
                type="button"
                onClick={() => setActiveTab('inputs')}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700 hover:border-pink-300 hover:bg-pink-50 hover:text-pink-700"
              >
                <FilePlus2 size={16} />
                Manage packet
              </button>

              {sources.map((source) => (
                <div
                  key={source.id}
                  className={`rounded-lg border bg-white p-3 shadow-sm transition ${
                    source.id === activeSourceId
                      ? 'border-pink-300 ring-2 ring-pink-100'
                      : source.included
                        ? 'border-gray-200'
                        : 'border-gray-100 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-950">{source.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <Badge>{source.role}</Badge>
                        {source.base && <Badge tone="info">Base</Badge>}
                        {source.inputMode !== 'sample' && (
                          <Badge tone={source.inputMode === 'uploaded' ? 'success' : 'info'}>
                            {source.inputMode === 'uploaded' ? 'Uploaded' : 'Pasted'}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSource(source.id)}
                      className={`h-6 w-10 rounded-full border p-0.5 transition ${
                        source.included ? 'border-emerald-200 bg-emerald-100' : 'border-gray-200 bg-gray-100'
                      }`}
                      aria-label={`${source.included ? 'Exclude' : 'Include'} ${source.name}`}
                    >
                      <span
                        className={`block h-4 w-4 rounded-full bg-white shadow transition ${source.included ? 'translate-x-4' : 'translate-x-0'}`}
                      />
                    </button>
                  </div>

                  {source.uploadedFileName && (
                    <div className="mt-2 truncate rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-600">{source.uploadedFileName}</div>
                  )}

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-gray-400">Format</div>
                      <div className="font-semibold text-gray-700">{source.format}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Sections</div>
                      <div className="font-semibold text-gray-700">{source.sections}</div>
                    </div>
                    <div>
                      <div className="text-gray-400">Words</div>
                      <div className="font-semibold text-gray-700">{source.words}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-semibold leading-none ${
                        statusColors[source.status]
                      }`}
                    >
                      {source.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => setBaseSource(source.id)}
                      className="rounded-md px-2 py-1 text-[11px] font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                    >
                      Set base
                    </button>
                  </div>

                  {source.warning && (
                    <div className="mt-2 flex items-start gap-2 rounded-md bg-amber-50 px-2 py-2 text-xs text-amber-800">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>{source.warning}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </aside>

          <main className="order-1 overflow-visible bg-[#fbfaf7] lg:order-none lg:min-h-0 lg:overflow-y-auto">
            {activeTab === 'inputs' && (
              <div className="p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-950">Prepare the packet</h2>
                    <p className="mt-1 text-sm text-gray-600">Load the estate-planning documents, confirm the base, and add the new instruction.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={packetComplete ? 'success' : 'warn'}>{includedSources.length} of {sources.length} present</Badge>
                    {reviewNeededCount > 0 && <Badge tone="warn">{reviewNeededCount} extraction review</Badge>}
                    <button
                      type="button"
                      onClick={generateComparison}
                      className="inline-flex items-center gap-2 rounded-md bg-gray-950 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"
                    >
                      <Wand2 size={14} />
                      Generate comparison
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {sources.map((source) => (
                    <div
                      key={source.id}
                      className={`rounded-lg border bg-white p-4 shadow-sm transition ${
                        source.id === activeSourceId ? 'border-pink-300 ring-2 ring-pink-100' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setActiveSourceId(source.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-600 hover:bg-pink-50 hover:text-pink-700"
                          aria-label={`Select ${source.role}`}
                        >
                          <FileText size={17} />
                        </button>
                        {source.base && <CheckCircle2 size={18} className="text-pink-500" />}
                      </div>
                      <h3 className="mt-4 text-sm font-semibold text-gray-950">{source.name}</h3>
                      <p className="mt-2 text-xs leading-5 text-gray-600">
                        {source.description}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        <Badge>{source.role}</Badge>
                        <Badge tone={source.status === 'Ready' ? 'success' : 'warn'}>{source.status}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <label
                          htmlFor={`drafting-magic-upload-${source.id}`}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold text-gray-700 hover:border-pink-300 hover:bg-pink-50 hover:text-pink-700"
                        >
                          <Upload size={14} />
                          Upload
                        </label>
                        <input
                          id={`drafting-magic-upload-${source.id}`}
                          type="file"
                          className="sr-only"
                          accept=".txt,.md,.doc,.docx,.pdf"
                          onChange={(event) => {
                            void handleSourceFile(source.id, event.currentTarget.files?.[0]);
                            event.currentTarget.value = '';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setBaseSource(source.id)}
                          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-xs font-semibold ${
                            source.base
                              ? 'border-pink-200 bg-pink-50 text-pink-700'
                              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <CheckCircle2 size={14} />
                          Base
                        </button>
                      </div>
                      <textarea
                        value={source.excerpt || ''}
                        onChange={(event) => handleSourcePaste(source.id, event.target.value)}
                        className="mt-3 h-20 w-full resize-none rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-pink-300 focus:bg-white focus:ring-2 focus:ring-pink-100"
                        placeholder={`Paste ${source.role.toLowerCase()} text or notes`}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-950">
                        <PencilLine size={16} />
                        Attorney update or new law
                      </div>
                      <Badge tone={analysisFresh ? 'success' : 'warn'}>{analysisFresh ? 'Matrix current' : 'Needs comparison refresh'}</Badge>
                    </div>
                    <textarea
                      value={attorneyUpdate}
                      onChange={(event) => {
                        setAttorneyUpdate(event.target.value);
                        markAnalysisStale();
                      }}
                      className="mt-3 h-28 w-full resize-none rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-6 text-gray-700 outline-none transition focus:border-pink-300 focus:bg-white focus:ring-2 focus:ring-pink-100"
                    />
                  </div>

                  <div className="rounded-lg border border-pink-100 bg-pink-50 p-4">
                    <div className="text-sm font-semibold text-pink-950">Active packet item</div>
                    <div className="mt-3 rounded-md bg-white/70 p-3">
                      <div className="text-sm font-semibold text-gray-950">{activeSource.name}</div>
                      <p className="mt-2 text-xs leading-5 text-gray-700">{activeSource.description}</p>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-gray-400">Format</div>
                          <div className="font-semibold text-gray-800">{activeSource.format}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Sections</div>
                          <div className="font-semibold text-gray-800">{activeSource.sections}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Words</div>
                          <div className="font-semibold text-gray-800">{activeSource.words}</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 rounded-md bg-white/70 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-gray-600">Extracted drafting units</div>
                        <Badge tone="info">{activeSourceUnits.length}</Badge>
                      </div>
                      <div className="mt-2 space-y-2">
                        {activeSourceUnits.slice(0, 3).map((unit) => (
                          <div key={unit.id} className="rounded-md border border-pink-100 bg-white px-2 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold text-gray-900">{unit.label}</div>
                              <span className="shrink-0 text-[11px] text-gray-500">{unit.confidence}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-600">{unit.snippet}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'compare' && (
              <div className="p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-950">Comparison matrix</h2>
                    <p className="mt-1 text-sm text-gray-600">Review the legal drafting units before the system writes anything.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={analysisFresh ? 'success' : 'warn'}>{analysisFresh ? 'Generated from packet' : 'Refresh recommended'}</Badge>
                    <Badge tone="warn">{reviewCount} open</Badge>
                    <Badge tone="success">{approvedCount} approved</Badge>
                    <button
                      type="button"
                      onClick={generateComparison}
                      className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <RefreshCw size={13} />
                      Regenerate
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                  <div className="grid grid-cols-[minmax(190px,1.1fr)_minmax(180px,1fr)_minmax(180px,1fr)_minmax(150px,0.8fr)] border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600">
                    <div className="px-3 py-2">Issue</div>
                    <div className="px-3 py-2">New-law impact</div>
                    <div className="px-3 py-2">Recommendation</div>
                    <div className="px-3 py-2">Action</div>
                  </div>

                  {rows.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedRowId(row.id)}
                      className={`grid w-full grid-cols-[minmax(190px,1.1fr)_minmax(180px,1fr)_minmax(180px,1fr)_minmax(150px,0.8fr)] border-b border-gray-100 text-left transition last:border-b-0 hover:bg-pink-50/50 ${
                        selectedRowId === row.id ? 'bg-pink-50' : 'bg-white'
                      }`}
                    >
                      <div className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-950">{row.issue}</span>
                          {!row.approved && <span className="h-2 w-2 rounded-full bg-amber-400" />}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">{row.rowType}</div>
                      </div>
                      <div className="px-3 py-3 text-xs leading-5 text-gray-700">{row.newLawImpact}</div>
                      <div className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-700">
                            {row.recommendation}
                          </span>
                          <span className="text-xs text-gray-500">{row.confidence}</span>
                        </div>
                        <div className="mt-2 line-clamp-2 text-xs leading-5 text-gray-600">{row.rationale}</div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${
                            row.approved ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'
                          }`}
                        >
                          {row.approved ? <Check size={13} /> : <AlertTriangle size={13} />}
                          {row.approved ? 'Approved' : 'Open'}
                        </span>
                        <ChevronRight size={15} className="ml-auto text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'strategy' && (
              <div className="p-5">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-950">Drafting strategy</h2>
                  <p className="mt-1 text-sm text-gray-600">Choose the drafting posture before generating the new document.</p>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {[
                    ['outputType', 'Output type', ['Estate plan review memo', 'Restated trust package', 'Client signing memo', 'Funding instruction letter']],
                    ['baseStrategy', 'Base strategy', ['Packet reconciliation', 'Use trust as base', 'Blend companion documents', 'Fresh integrated draft']],
                    ['tone', 'Tone', ['Client-friendly', 'Formal', 'Plain English', 'Attorney working draft']],
                    ['citations', 'Review posture', ['Attorney checklist', 'Inline source notes', 'Signing packet flags', 'No notes']],
                  ].map(([key, label, options]) => (
                    <div key={key as string} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                      <h3 className="text-sm font-semibold text-gray-950">{label as string}</h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(options as string[]).map((option) => {
                          const active = strategy[key as keyof typeof strategy] === option;
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => {
                                setStrategy((current) => ({ ...current, [key as string]: option }));
                                markDraftStale();
                              }}
                              className={`rounded-md border px-3 py-2 text-xs font-semibold transition ${
                                active
                                  ? 'border-gray-950 bg-gray-950 text-white'
                                  : 'border-gray-200 bg-white text-gray-700 hover:border-pink-300 hover:bg-pink-50'
                              }`}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-950">Output outline</h3>
                      <p className="mt-1 text-xs text-gray-600">This plan uses approved rows and flags open items for attorney review.</p>
                    </div>
                    <button
                      type="button"
                      onClick={generateDraft}
                      disabled={isGeneratingDraft || !sanitizerReady || !sanitizerUnlocked}
                      className="inline-flex items-center gap-2 rounded-md bg-pink-500 px-3 py-2 text-xs font-semibold text-white hover:bg-pink-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {isGeneratingDraft ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          {generationStatus === 'sanitizing' ? 'Sanitizing packet' : 'Generating draft'}
                        </>
                      ) : (
                        <>
                          Generate cloud draft
                          <ArrowRight size={14} />
                        </>
                      )}
                    </button>
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    {draftSections.map((section, index) => (
                      <div key={section.id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                        <div className="text-[11px] font-semibold text-gray-400">Section {index + 1}</div>
                        <div className="mt-1 text-sm font-semibold text-gray-900">{section.title}</div>
                        <div className="mt-2 text-xs leading-5 text-gray-600">{section.requirements}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'draft' && (
              <div className="p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-950">Draft preview</h2>
                    <p className="mt-1 text-sm text-gray-600">Each section carries lineage, requirement mapping, and review status.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={draftReady ? 'success' : 'warn'}>{draftReady ? 'Draft current' : 'Needs regeneration'}</Badge>
                    <button
                      type="button"
                      onClick={generateDraft}
                      disabled={isGeneratingDraft || !sanitizerReady || !sanitizerUnlocked}
                      className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      {isGeneratingDraft ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      {generationStatus === 'sanitizing' ? 'Sanitizing packet' : generationStatus === 'generating' ? 'Generating draft' : 'Regenerate cloud draft'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void exportDraftDocx()}
                      disabled={isExportingDocx}
                      className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      {isExportingDocx ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      {isExportingDocx ? 'Exporting DOCX' : 'Export draft DOCX'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('review')}
                      className="inline-flex items-center gap-2 rounded-md bg-gray-950 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"
                    >
                      Review checklist
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>

                {!draftReady && (
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <span>The comparison matrix or drafting strategy changed. Regenerate before treating this preview as current.</span>
                  </div>
                )}

                {isGeneratingDraft && (
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                    <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" />
                    <span>
                      {generationStatus === 'sanitizing'
                        ? 'Tokenizing the packet locally before it leaves the browser.'
                        : 'Sending the tokenized packet to the Bedrock drafter.'}
                    </span>
                  </div>
                )}

                {generationError && (
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <span>{generationError}</span>
                  </div>
                )}

                {draftExportError && (
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <span>{draftExportError}</span>
                  </div>
                )}

                {lastDraftedLabel && !generationError && (
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    <ShieldCheck size={16} className="mt-0.5 shrink-0" />
                    <span>Cloud draft generated from a tokenized packet at {lastDraftedLabel}; display text was rehydrated locally.</span>
                  </div>
                )}

                <div className="space-y-3">
                  {draftSections.map((section) => {
                    const isSelected = selectedSectionId === section.id;
                    const isRegeneratingThis = regeneratingSectionId === section.id;

                    return (
                      <article
                        key={section.id}
                        onClick={() => setSelectedSectionId(section.id)}
                        className={`rounded-lg border bg-white p-5 text-left shadow-sm transition hover:border-pink-200 ${
                          isSelected ? 'border-pink-300 ring-2 ring-pink-100' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <input
                              value={section.title}
                              onChange={(event) => editDraftSection(section.id, { title: event.target.value })}
                              onFocus={() => setSelectedSectionId(section.id)}
                              className="w-full rounded-md border border-transparent bg-transparent px-0 py-1 text-base font-semibold text-gray-950 outline-none transition focus:border-pink-200 focus:bg-pink-50/40 focus:px-2"
                              aria-label={`Edit title for ${section.title}`}
                            />
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span
                                className={`rounded-md border px-2 py-1 text-[11px] font-semibold leading-none ${
                                  statusColors[section.status] || 'border-gray-200 bg-gray-50 text-gray-700'
                                }`}
                              >
                                {section.status}
                              </span>
                              {section.locked && <Badge tone="info">Locked</Badge>}
                              {section.editedAt && <Badge tone="success">Edited</Badge>}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleDraftSectionLock(section.id);
                              }}
                              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-xs font-semibold ${
                                section.locked
                                  ? 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
                                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                              }`}
                              aria-pressed={Boolean(section.locked)}
                            >
                              {section.locked ? <Lock size={14} /> : <Unlock size={14} />}
                              {section.locked ? 'Locked' : 'Lock'}
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void regenerateDraftSection(section.id);
                              }}
                              disabled={isGeneratingDraft || Boolean(section.locked)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                            >
                              {isRegeneratingThis ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                              {isRegeneratingThis ? 'Regenerating' : 'Regenerate section'}
                            </button>
                          </div>
                        </div>

                        <textarea
                          value={section.content}
                          onChange={(event) => editDraftSection(section.id, { content: event.target.value })}
                          onFocus={() => setSelectedSectionId(section.id)}
                          className="mt-3 min-h-32 w-full resize-y rounded-md border border-gray-200 bg-gray-50 px-3 py-3 text-sm leading-7 text-gray-700 outline-none transition focus:border-pink-300 focus:bg-white focus:ring-2 focus:ring-pink-100"
                          aria-label={`Edit draft content for ${section.title}`}
                        />

                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1">
                            <Highlighter size={14} />
                            {section.lineage}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <ClipboardCheck size={14} />
                            {section.requirements}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'review' && (
              <div className="p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-950">Review and export readiness</h2>
                    <p className="mt-1 text-sm text-gray-600">Map every requirement to draft text before the attorney exports.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="warn">Ready with warnings</Badge>
                    <button
                      type="button"
                      onClick={() => void exportDraftDocx()}
                      disabled={isExportingDocx}
                      className="inline-flex items-center gap-2 rounded-md bg-gray-950 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {isExportingDocx ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      {isExportingDocx ? 'Exporting DOCX' : 'Export draft DOCX'}
                    </button>
                  </div>
                </div>

                {draftExportError && (
                  <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <span>{draftExportError}</span>
                  </div>
                )}

                <div className="grid gap-3">
                  {complianceItems.map((item) => (
                    <div key={item.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-950">{item.requirement}</h3>
                          <p className="mt-2 text-xs leading-5 text-gray-600">{item.evidence}</p>
                        </div>
                        <span
                          className={`rounded-md border px-2 py-1 text-[11px] font-semibold leading-none ${
                            statusColors[item.status] || 'border-amber-200 bg-amber-50 text-amber-700'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                        <FileCheck2 size={14} />
                        Draft location: {item.location}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>

          <aside className="order-3 overflow-visible border-l border-gray-200 bg-white lg:order-none lg:min-h-0 lg:overflow-y-auto">
            <SectionHeader icon={<PanelRight size={15} />} title="Decision Detail" meta={activeTab} />

            <div className="space-y-4 p-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-950">
                  <GitCompareArrows size={16} />
                  {selectedRow.issue}
                </div>
                <div className="mt-3 space-y-3 text-xs leading-5 text-gray-700">
                  <div>
                    <div className="font-semibold text-gray-500">{selectedRow.sourceALabel}</div>
                    {selectedRow.sourceA}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-500">{selectedRow.sourceBLabel}</div>
                    {selectedRow.sourceB}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-500">{selectedRow.sourceCLabel}</div>
                    {selectedRow.sourceC}
                  </div>
                </div>

                <div className="mt-4 rounded-md border border-white bg-white p-3">
                  <div className="text-xs font-semibold text-gray-500">Recommendation rationale</div>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{selectedRow.rationale}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(['Keep', 'Revise', 'Discard', 'Add', 'Review'] as RowRecommendation[]).map((recommendation) => (
                    <button
                      key={recommendation}
                      type="button"
                      onClick={() => setRecommendation(selectedRow.id, recommendation)}
                      className={`rounded-md border px-2 py-1.5 text-xs font-semibold ${
                        selectedRow.recommendation === recommendation
                          ? 'border-gray-950 bg-gray-950 text-white'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {recommendation}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => toggleApproval(selectedRow.id)}
                  className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold ${
                    selectedRow.approved
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-pink-500 text-white hover:bg-pink-600'
                  }`}
                >
                  {selectedRow.approved ? <CheckCircle2 size={14} /> : <Check size={14} />}
                  {selectedRow.approved ? 'Mark as open' : 'Approve recommendation'}
                </button>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-950">
                    <Sparkles size={16} />
                    Draft lineage
                  </div>
                  <Badge tone={selectedSection.locked ? 'info' : 'neutral'}>{selectedSection.locked ? 'Locked' : 'Editable'}</Badge>
                </div>
                <div className="mt-3 rounded-md bg-gray-50 p-3">
                  <div className="text-sm font-semibold text-gray-900">{selectedSection.title}</div>
                  <p className="mt-2 text-xs leading-5 text-gray-600">{selectedSection.content}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => toggleDraftSectionLock(selectedSection.id)}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-2 text-xs font-semibold ${
                      selectedSection.locked
                        ? 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {selectedSection.locked ? <Lock size={14} /> : <Unlock size={14} />}
                    {selectedSection.locked ? 'Unlock section' : 'Lock section'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void regenerateDraftSection(selectedSection.id)}
                    disabled={isGeneratingDraft || Boolean(selectedSection.locked)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    {regeneratingSectionId === selectedSection.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    {regeneratingSectionId === selectedSection.id ? 'Regenerating' : 'Regenerate'}
                  </button>
                </div>
                <div className="mt-3 space-y-2 text-xs text-gray-600">
                  <div className="flex items-start gap-2">
                    <Highlighter size={14} className="mt-0.5 shrink-0 text-gray-500" />
                    <span>{selectedSection.lineage}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <ShieldCheck size={14} className="mt-0.5 shrink-0 text-gray-500" />
                    <span>{selectedSection.requirements}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Lock size={14} className="mt-0.5 shrink-0 text-gray-500" />
                    <span>
                      {selectedSectionEditedLabel
                        ? `Edited locally at ${selectedSectionEditedLabel}. Locked sections are preserved during regeneration.`
                        : 'Lock a section to preserve attorney edits during regeneration.'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-pink-100 bg-pink-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-pink-900">
                  <Scale size={16} />
                  Product posture
                </div>
                <p className="mt-2 text-xs leading-5 text-pink-900">
                  This surface is a drafting workbench: compare first, approve the plan, draft second, review before export.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default DraftingMagicPage;
