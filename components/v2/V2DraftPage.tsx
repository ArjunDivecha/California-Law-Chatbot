/**
 * V2 drafting surface. Reachable at /v2/draft (gated by Clerk SignedIn,
 * same posture as /v2). Three-pane flow:
 *
 *   1. Template picker — 4 cards for legal_memo, demand_letter,
 *      client_letter, motion_compel
 *   2. Variables form — dynamic per-template inputs (text, textarea,
 *      date, select, number)
 *   3. Streaming output — privilege chip + tool pills + live token
 *      stream as the agent loop runs. Drives /api/agent/draft-stream.
 *
 * Mirrors V2ChatPage's visual language (Georgia serif, FAFAF8 bg, pink
 * accents). Standalone — does not share state with the chat surface,
 * which is deliberate per Phase 4: drafting and chat are distinct
 * workflows.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useV2DraftStream } from '../../hooks/useV2DraftStream.ts';
import { useV2VerifyStream, type V2Verdict } from '../../hooks/useV2VerifyStream.ts';
import { DEFAULT_TEST_DATA } from '../drafting/defaultTestData.ts';
import { V2SanitizationChip } from './V2SanitizationChip';
import { gateOnVerdicts } from '../../services/confidenceGatingV2.ts';

// ---------------------------------------------------------------------------
// Template metadata — UI-side mirror of api/templates.ts. Kept in sync via
// review; an automated test that diffs the two would be a Phase 4.x
// hardening item.
// ---------------------------------------------------------------------------

interface VariableField {
  id: string;
  name: string;
  type: 'text' | 'textarea' | 'date' | 'select' | 'number';
  required?: boolean;
  placeholder?: string;
  default?: string;
  options?: string[];
}

interface TemplateMeta {
  id: 'legal_memo' | 'demand_letter' | 'client_letter' | 'motion_compel';
  name: string;
  description: string;
  estimatedTime: string;
  variables: VariableField[];
}

const TEMPLATES: TemplateMeta[] = [
  {
    id: 'legal_memo',
    name: 'Legal Research Memorandum',
    description:
      'Internal IRAC/CREAC analysis of a discrete legal question. 6 sections — Question Presented, Brief Answer, Facts, Analysis, Conclusion.',
    estimatedTime: '60–120 seconds',
    variables: [
      { id: 'to', name: 'To (Partner / Supervising Attorney)', type: 'text', required: true, placeholder: 'Jane Partner' },
      { id: 'from', name: 'From (Drafting Attorney)', type: 'text', required: true, placeholder: 'John Associate' },
      { id: 'client_matter', name: 'Client / Matter', type: 'text', required: true, placeholder: 'Estate of Smith' },
      { id: 'date', name: 'Date', type: 'date', required: true },
      { id: 'subject', name: 'Subject (Re:)', type: 'text', required: true, placeholder: 'Validity of holographic codicil' },
    ],
  },
  {
    id: 'demand_letter',
    name: 'Demand Letter',
    description:
      'External formal demand — payment, breach, cease-and-desist, return of property, or specific performance. 7 sections, served under California civil law.',
    estimatedTime: '45–90 seconds',
    variables: [
      { id: 'sender_name', name: 'Sender Name (Attorney)', type: 'text', required: true, placeholder: 'A. Counsel' },
      { id: 'sender_firm', name: 'Sender Firm', type: 'text', placeholder: 'Femme & Femme Law' },
      { id: 'sender_address', name: 'Sender Address', type: 'textarea', required: true, placeholder: '123 Main St\nOakland, CA 94612' },
      { id: 'recipient_name', name: 'Recipient Name', type: 'text', required: true, placeholder: 'ABC Construction Co.' },
      { id: 'recipient_address', name: 'Recipient Address', type: 'textarea', required: true, placeholder: '500 Oak Ave\nOakland, CA 94612' },
      { id: 'date', name: 'Date', type: 'date', required: true },
      {
        id: 'demand_type',
        name: 'Type of Demand',
        type: 'select',
        required: true,
        options: ['Payment of Debt', 'Breach of Contract', 'Cease and Desist', 'Return of Property', 'Performance of Agreement'],
      },
      { id: 'amount', name: 'Amount Demanded (if applicable)', type: 'text', placeholder: '$10,000.00' },
      { id: 'response_deadline', name: 'Response Deadline (days)', type: 'number', required: true, default: '30' },
      { id: 'client_name', name: 'Client Name', type: 'text', required: true, placeholder: "Smith Properties LLC" },
    ],
  },
  {
    id: 'client_letter',
    name: 'Client Advisory Letter',
    description:
      'Privileged attorney–client communication explaining a matter, presenting options with pros/cons, and recommending a path forward. 7 sections.',
    estimatedTime: '45–90 seconds',
    variables: [
      { id: 'attorney_name', name: 'Attorney Name', type: 'text', required: true, placeholder: 'A. Counsel' },
      { id: 'firm_name', name: 'Firm Name', type: 'text', placeholder: 'Femme & Femme Law' },
      { id: 'firm_address', name: 'Firm Address', type: 'textarea', required: true, placeholder: '123 Main St\nOakland, CA 94612' },
      { id: 'client_name', name: 'Client Name', type: 'text', required: true, placeholder: "Maria Garcia" },
      { id: 'client_address', name: 'Client Address', type: 'textarea', required: true, placeholder: '789 Elm St\nOakland, CA 94612' },
      { id: 'date', name: 'Date', type: 'date', required: true },
      { id: 'matter_description', name: 'Matter Description', type: 'text', required: true, placeholder: 'Workplace harassment claim' },
      { id: 'salutation', name: 'Salutation', type: 'text', required: true, default: 'Dear' },
    ],
  },
  {
    id: 'motion_compel',
    name: 'Motion to Compel Discovery',
    description:
      'California Superior Court motion under CCP §§ 2030.300 / 2031.310 / 2033.290 for further discovery responses. 10 sections including caption, MPA, declaration, separate statement reference.',
    estimatedTime: '120–180 seconds',
    variables: [
      {
        id: 'court_name',
        name: 'Court',
        type: 'select',
        required: true,
        options: [
          'Superior Court of California, County of Los Angeles',
          'Superior Court of California, County of San Francisco',
          'Superior Court of California, County of San Diego',
          'Superior Court of California, County of Orange',
          'Superior Court of California, County of Santa Clara',
          'Superior Court of California, County of Alameda',
          'Superior Court of California, County of Sacramento',
          'Superior Court of California, County of Riverside',
          'Superior Court of California, County of San Bernardino',
        ],
      },
      { id: 'case_number', name: 'Case Number', type: 'text', required: true, placeholder: '24CV001234' },
      { id: 'plaintiff', name: 'Plaintiff(s)', type: 'text', required: true },
      { id: 'defendant', name: 'Defendant(s)', type: 'text', required: true },
      { id: 'moving_party', name: 'Moving Party', type: 'text', required: true, placeholder: 'Plaintiff [Name]' },
      { id: 'responding_party', name: 'Responding Party', type: 'text', required: true, placeholder: 'Defendant [Name]' },
      { id: 'attorney_name', name: 'Attorney Name', type: 'text', required: true },
      { id: 'firm_name', name: 'Firm Name', type: 'text' },
      { id: 'bar_number', name: 'State Bar Number', type: 'text', required: true, placeholder: '123456' },
      {
        id: 'discovery_type',
        name: 'Discovery Type',
        type: 'select',
        required: true,
        options: [
          'Form Interrogatories',
          'Special Interrogatories',
          'Request for Production of Documents',
          'Request for Admissions',
          'Deposition Questions',
        ],
      },
      { id: 'discovery_set_number', name: 'Discovery Set Number', type: 'text', required: true, default: 'One' },
      { id: 'hearing_date', name: 'Hearing Date', type: 'date', required: true },
      { id: 'hearing_time', name: 'Hearing Time', type: 'text', required: true, placeholder: '9:00 a.m.' },
      { id: 'hearing_department', name: 'Department', type: 'text', required: true, placeholder: '22' },
      { id: 'meet_confer_attempts', name: 'Meet-and-Confer Attempts', type: 'text', placeholder: '3 letters' },
      { id: 'deficient_response_examples', name: 'Deficient Responses (item numbers)', type: 'text', placeholder: 'Nos. 3, 7, 12, 18' },
    ],
  },
];

function newSessionId(): string {
  return `v2d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toolHumanName(name: string): string {
  switch (name) {
    case 'ceb_search': return 'CEB practice guides';
    case 'courtlistener_search': return 'CourtListener case law';
    case 'legiscan_search': return 'LegiScan';
    case 'openstates_search': return 'OpenStates';
    case 'citation_verify': return 'Citation verifier';
    case 'web_search': return 'Web search';
    default: return name;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export const V2DraftPage: React.FC = () => {
  const { user } = useUser();
  const userId = user?.id ?? null;

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [instructions, setInstructions] = useState('');
  const [maxLength, setMaxLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [tone, setTone] = useState<'formal' | 'persuasive' | 'neutral'>('neutral');
  const [sessionId] = useState(() => newSessionId());
  const { state, send, reset } = useV2DraftStream();
  const verifyHook = useV2VerifyStream();

  const template = useMemo(
    () => TEMPLATES.find((t) => t.id === selectedTemplateId) ?? null,
    [selectedTemplateId],
  );

  const onSelectTemplate = useCallback((id: TemplateMeta['id']) => {
    setSelectedTemplateId(id);
    // Pre-fill defaults
    const t = TEMPLATES.find((x) => x.id === id);
    if (t) {
      const init: Record<string, string> = {};
      for (const v of t.variables) {
        if (v.default) init[v.id] = v.default;
        else if (v.type === 'date') init[v.id] = new Date().toISOString().slice(0, 10);
      }
      setVariables(init);
    }
    reset();
  }, [reset]);

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!template || state.isStreaming) return;
      void send({
        session_id: sessionId,
        template_id: template.id,
        variables,
        user_instructions: instructions.trim(),
        options: { maxLength, tone, citationStyle: 'california' },
        user_id: userId,
      });
    },
    [template, state.isStreaming, send, sessionId, variables, instructions, maxLength, tone, userId],
  );

  const requiredMissing = useMemo(() => {
    if (!template) return [];
    return template.variables
      .filter((v) => v.required && !(variables[v.id] && variables[v.id].trim()))
      .map((v) => v.name);
  }, [template, variables]);

  const canSubmit = template && requiredMissing.length === 0 && instructions.trim().length > 10 && !state.isStreaming;

  const privilegedBadge = useMemo(() => {
    if (!state.sanitization) return null;
    const { privileged, compound_risk_buckets, redactions_count } = state.sanitization;
    // Informational only — sanitization still detects, but the
    // privileged flag no longer gates web_search (7th addendum).
    if (privileged) {
      const reasons: string[] = [];
      if (compound_risk_buckets > 0) reasons.push(`compound risk ×${compound_risk_buckets}`);
      if (redactions_count > 0) reasons.push(`${redactions_count} redaction${redactions_count > 1 ? 's' : ''}`);
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
          ⚠️ Privileged content detected
          {reasons.length > 0 && <span className="text-amber-700/80">({reasons.join(' · ')})</span>}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
        🌐 No privileged content detected
      </span>
    );
  }, [state.sanitization]);

  return (
    <div
      className="flex flex-col h-screen"
      style={{ backgroundColor: '#FAFAF8', fontFamily: 'Georgia, "Times New Roman", serif' }}
    >
      <header className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm">
              <img src="/Heart Favicon.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">California Law Chatbot</h1>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-pink-500">
                V2 Drafting · Anthropic Agent Loop
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link to="/v2" className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-700 hover:bg-gray-200">
              ← Chat
            </Link>
            <span className="text-gray-400">
              session: <span className="font-mono">{sessionId.slice(0, 14)}…</span>
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <div className="mx-auto h-full max-w-5xl flex flex-col px-6 py-6 overflow-y-auto">
          {!template && (
            <TemplatePicker templates={TEMPLATES} onSelect={onSelectTemplate} />
          )}

          {template && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LEFT: form */}
              <section className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">{template.name}</h2>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        // P3.1 — pre-fill from defaultTestData for fast iteration
                        const td = DEFAULT_TEST_DATA[template.id];
                        if (td) {
                          setVariables(td.variables);
                          setInstructions(td.instructions);
                        }
                      }}
                      className="text-xs rounded-full border border-pink-300 text-pink-700 hover:bg-pink-50 px-2 py-0.5"
                      disabled={state.isStreaming}
                      title="Pre-fill variables + instructions with a known-good example"
                    >
                      Use test data
                    </button>
                    <button
                      onClick={() => onSelectTemplate(null as any)}
                      className="text-xs text-pink-600 hover:underline"
                      disabled={state.isStreaming}
                    >
                      Change template
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-4">{template.description}</p>

                <form onSubmit={onSubmit} className="space-y-3">
                  <VariableForm
                    template={template}
                    values={variables}
                    onChange={(id, value) => setVariables((v) => ({ ...v, [id]: value }))}
                    disabled={state.isStreaming}
                  />

                  <label className="block">
                    <span className="block text-xs font-semibold text-gray-700 mb-1">
                      Drafting Instructions <span className="text-red-500">*</span>
                    </span>
                    <textarea
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="Facts of the matter and what you need analyzed / drafted. The more specific, the better the draft."
                      rows={5}
                      className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-pink-400 focus:outline-none"
                      disabled={state.isStreaming}
                    />
                    {/* Preview chip — scans instructions + every variable
                        value so the attorney sees what will be tokenized
                        across the whole submission, not just instructions. */}
                    <div className="mt-2">
                      <V2SanitizationChip
                        text={[instructions, ...Object.values(variables)].filter(Boolean).join('\n')}
                      />
                    </div>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-xs font-semibold text-gray-700 mb-1">Length</span>
                      <select
                        value={maxLength}
                        onChange={(e) => setMaxLength(e.target.value as typeof maxLength)}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                        disabled={state.isStreaming}
                      >
                        <option value="short">Short</option>
                        <option value="medium">Medium</option>
                        <option value="long">Long</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="block text-xs font-semibold text-gray-700 mb-1">Tone</span>
                      <select
                        value={tone}
                        onChange={(e) => setTone(e.target.value as typeof tone)}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                        disabled={state.isStreaming}
                      >
                        <option value="neutral">Neutral</option>
                        <option value="formal">Formal</option>
                        <option value="persuasive">Persuasive</option>
                      </select>
                    </label>
                  </div>

                  {requiredMissing.length > 0 && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                      Missing required: {requiredMissing.join(', ')}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="w-full rounded-lg bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-pink-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {state.isStreaming ? 'Drafting…' : `Draft ${template.name}`}
                  </button>
                  <p className="text-[11px] text-gray-400 text-center">
                    Est. {template.estimatedTime}. Streams sections as the model produces them.
                  </p>
                </form>
              </section>

              {/* RIGHT: streaming output */}
              <section className="rounded-2xl border border-gray-200 bg-white p-5 min-h-[500px] overflow-hidden flex flex-col">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Draft Output</h2>

                {!state.isStreaming && !state.tokens && !state.error && (
                  <div className="text-center text-sm text-gray-400 py-12">
                    Fill in the form and click Draft to begin. Output streams here in real time.
                  </div>
                )}

                {(state.isStreaming || state.tokens) && (
                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {privilegedBadge && <div>{privilegedBadge}</div>}

                    {/* Section-progress bar (P3.5) — fills as the model
                        emits `## SECTION:` markers so the attorney can
                        see what's done vs still pending. */}
                    {template && state.tokens && (
                      <SectionProgressBar
                        draftText={state.tokens}
                        expectedSections={getExpectedSections(template.id)}
                      />
                    )}

                    {state.toolEvents.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {state.toolEvents.map((t) => (
                          <ToolPill key={t.id} tool={t} />
                        ))}
                      </div>
                    )}

                    {state.tokens && (
                      <div className="text-[13px] leading-relaxed text-gray-900 v2-md">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ node, ...props }) => (
                              <a
                                {...props}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-pink-600 underline hover:text-pink-700"
                              />
                            ),
                            h2: ({ node, ...props }) => (
                              <h2
                                {...props}
                                className="mt-4 mb-2 text-sm font-semibold uppercase tracking-wider text-pink-600 border-t border-gray-100 pt-3"
                              />
                            ),
                          }}
                        >
                          {state.tokens}
                        </ReactMarkdown>
                        {state.isStreaming && <span className="ml-1 inline-block animate-pulse">▍</span>}
                      </div>
                    )}

                    {!state.tokens && state.round > 0 && (
                      <div className="text-sm text-gray-500 italic">
                        {state.round === 1 ? 'Researching…' : `Working on round ${state.round}…`}
                      </div>
                    )}
                  </div>
                )}

                {state.error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mt-3">
                    <strong className="font-semibold">
                      {state.error.proxy ? 'Gate error' : 'Stream error'} —{' '}
                    </strong>
                    <span className="font-mono text-xs">{state.error.code}</span>
                    <div className="mt-1">{state.error.message}</div>
                  </div>
                )}

                {state.quality_warning && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 mt-3">
                    <strong className="font-semibold">Quality warning — </strong>
                    <span className="text-xs">
                      {state.quality_warning.issues.join(', ')}
                      {state.quality_warning.missing_sections.length > 0 &&
                        ` (missing: ${state.quality_warning.missing_sections.join(', ')})`}
                    </span>
                    <div className="text-xs mt-1 text-amber-700">
                      The draft may be incomplete. Consider clicking Draft again.
                    </div>
                  </div>
                )}

                {state.done && (
                  <div className="text-xs text-gray-400 text-right mt-3 border-t border-gray-100 pt-2">
                    {state.done.tool_rounds} tool round{state.done.tool_rounds === 1 ? '' : 's'} ·{' '}
                    {state.done.total_tokens.toLocaleString()} tokens ·{' '}
                    {Math.round(state.done.elapsed_ms / 100) / 10}s ·{' '}
                    stop={state.done.stop_reason}
                  </div>
                )}

                {state.done && state.tokens && template && (
                  <DocumentPreviewPanel
                    draftText={state.tokens}
                    template={template}
                    variables={variables}
                    sessionId={sessionId}
                    userId={userId}
                  />
                )}

                {state.done && state.tokens && template && (
                  <ExportPanel
                    draftText={state.tokens}
                    template={template}
                  />
                )}

                {state.done && state.tokens && (
                  <VerificationPanel
                    draftText={state.tokens}
                    verifyHook={verifyHook}
                  />
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

const TemplatePicker: React.FC<{
  templates: TemplateMeta[];
  onSelect: (id: TemplateMeta['id']) => void;
}> = ({ templates, onSelect }) => (
  <div>
    <h2 className="text-xl font-semibold text-gray-900 mb-2">Choose a document type</h2>
    <p className="text-sm text-gray-500 mb-6">
      Each template streams a structured California-legal draft with verified citations. The
      drafting Skill, system prompt, and tools are selected automatically by template.
    </p>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {templates.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.id)}
          className="text-left rounded-2xl border border-gray-200 bg-white p-5 hover:border-pink-400 hover:shadow-sm transition"
        >
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-base font-semibold text-gray-900">{t.name}</h3>
            <span className="text-[11px] text-gray-400 font-mono">{t.id}</span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed mb-3">{t.description}</p>
          <div className="text-[11px] text-pink-600 font-semibold">{t.estimatedTime}</div>
        </button>
      ))}
    </div>
  </div>
);

const VariableForm: React.FC<{
  template: TemplateMeta;
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  disabled?: boolean;
}> = ({ template, values, onChange, disabled }) => (
  <div className="grid grid-cols-1 gap-2">
    {template.variables.map((v) => (
      <label key={v.id} className="block">
        <span className="block text-xs font-semibold text-gray-700 mb-0.5">
          {v.name}
          {v.required && <span className="text-red-500"> *</span>}
        </span>
        {v.type === 'textarea' ? (
          <textarea
            value={values[v.id] ?? ''}
            onChange={(e) => onChange(v.id, e.target.value)}
            placeholder={v.placeholder}
            rows={2}
            disabled={disabled}
            className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-pink-400 focus:outline-none"
          />
        ) : v.type === 'select' ? (
          <select
            value={values[v.id] ?? ''}
            onChange={(e) => onChange(v.id, e.target.value)}
            disabled={disabled}
            className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
          >
            <option value="">Select…</option>
            {v.options?.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ) : (
          <input
            type={v.type === 'number' ? 'number' : v.type === 'date' ? 'date' : 'text'}
            value={values[v.id] ?? ''}
            onChange={(e) => onChange(v.id, e.target.value)}
            placeholder={v.placeholder}
            disabled={disabled}
            className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-pink-400 focus:outline-none"
          />
        )}
      </label>
    ))}
  </div>
);

/**
 * DocumentPreviewPanel (P3.2 + P3.3) — breaks the streamed draft into
 * sections after `done` and lets the attorney edit/revise per-section.
 *
 *   Edit:    inline textarea, "Save" → updates local section text
 *   Revise:  small textarea for revision instructions → POST to
 *            /api/agent/revise-section → replacement streams in
 *
 * Local state owns the sections; Export + Verification panels read from
 * a recombined text passed back up via callback. (Future: lift state if
 * we need cross-pane consistency.)
 */
const DocumentPreviewPanel: React.FC<{
  draftText: string;
  template: TemplateMeta;
  variables: Record<string, string>;
  sessionId: string;
  userId: string | null;
}> = ({ draftText, template, variables, sessionId, userId }) => {
  const initialSections = useMemo(() => parseDraftSections(draftText), [draftText]);
  const [sections, setSections] = useState(initialSections);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [revisingId, setRevisingId] = useState<string | null>(null);
  const [revisionDrafts, setRevisionDrafts] = useState<Record<string, string>>({});
  const [revisionInstructions, setRevisionInstructions] = useState<Record<string, string>>({});
  const [revisionStreamingId, setRevisionStreamingId] = useState<string | null>(null);
  const [revisionError, setRevisionError] = useState<string | null>(null);

  useEffect(() => {
    setSections(initialSections);
  }, [initialSections]);

  const onSave = useCallback((id: string, newText: string) => {
    setSections((prev) => prev.map((s) => (s.sectionId === id ? { ...s, content: newText, wordCount: newText.split(/\s+/).filter((w) => w).length } : s)));
    setEditingId(null);
  }, []);

  const onRevise = useCallback(
    async (sectionId: string) => {
      const section = sections.find((s) => s.sectionId === sectionId);
      if (!section) return;
      const instructions = revisionInstructions[sectionId]?.trim();
      if (!instructions) return;
      setRevisionStreamingId(sectionId);
      setRevisionError(null);
      // Gather other sections as context
      const fullContext = sections
        .filter((s) => s.sectionId !== sectionId)
        .map((s) => `## SECTION: ${s.sectionId}\n${s.content}`)
        .join('\n\n');
      try {
        const resp = await fetch('/api/agent/revise-section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_id: template.id,
            section_id: sectionId,
            section_name: section.sectionName,
            current_text: section.content,
            revision_instructions: instructions,
            variables,
            full_context: fullContext,
            session_id: sessionId,
            user_id: userId,
          }),
        });
        if (!resp.ok || !resp.body) {
          setRevisionError(`HTTP ${resp.status}`);
          setRevisionStreamingId(null);
          return;
        }
        const reader = resp.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let newText = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sep = buffer.indexOf('\n\n');
          while (sep !== -1) {
            const raw = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const lines = raw.split('\n');
            let kind = '';
            let data = '';
            for (const l of lines) {
              if (l.startsWith('event: ')) kind = l.slice(7);
              else if (l.startsWith('data: ')) data = l.slice(6);
            }
            if (kind === 'token' && data) {
              try {
                const payload = JSON.parse(data);
                newText += payload.text ?? '';
                setRevisionDrafts((d) => ({ ...d, [sectionId]: newText }));
              } catch {}
            }
            sep = buffer.indexOf('\n\n');
          }
        }
        // On finish, commit the revision into the section text
        if (newText.trim()) {
          setSections((prev) => prev.map((s) => (s.sectionId === sectionId ? { ...s, content: newText.trim(), wordCount: newText.split(/\s+/).filter((w) => w).length } : s)));
        }
        setRevisingId(null);
        setRevisionStreamingId(null);
        setRevisionDrafts((d) => {
          const { [sectionId]: _drop, ...rest } = d;
          return rest;
        });
        setRevisionInstructions((d) => ({ ...d, [sectionId]: '' }));
      } catch (err) {
        setRevisionError((err as Error).message);
        setRevisionStreamingId(null);
      }
    },
    [sections, revisionInstructions, template.id, variables, sessionId, userId],
  );

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Document Preview ({sections.length} sections)</h3>
      <div className="space-y-3">
        {sections.map((s) => {
          const isEditing = editingId === s.sectionId;
          const isRevising = revisingId === s.sectionId;
          const isStreaming = revisionStreamingId === s.sectionId;
          const streamingText = revisionDrafts[s.sectionId];
          return (
            <div key={s.sectionId} className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[12px] font-semibold uppercase tracking-wider text-pink-600">
                  {s.sectionName} <span className="text-gray-400 font-normal normal-case">· {s.wordCount} words</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  {!isEditing && !isRevising && (
                    <>
                      <button type="button" className="text-pink-600 hover:underline" onClick={() => setEditingId(s.sectionId)}>
                        Edit
                      </button>
                      <button type="button" className="text-pink-600 hover:underline" onClick={() => setRevisingId(s.sectionId)}>
                        Revise with AI
                      </button>
                    </>
                  )}
                </div>
              </div>
              {isEditing ? (
                <SectionEditor
                  initialText={s.content}
                  onSave={(t) => onSave(s.sectionId, t)}
                  onCancel={() => setEditingId(null)}
                />
              ) : isRevising ? (
                <SectionReviser
                  current={s.content}
                  instructions={revisionInstructions[s.sectionId] ?? ''}
                  onChangeInstructions={(t) =>
                    setRevisionInstructions((d) => ({ ...d, [s.sectionId]: t }))
                  }
                  onSubmit={() => onRevise(s.sectionId)}
                  onCancel={() => {
                    setRevisingId(null);
                    setRevisionInstructions((d) => ({ ...d, [s.sectionId]: '' }));
                  }}
                  streaming={isStreaming}
                  streamingText={streamingText}
                  error={isStreaming ? null : revisionError}
                />
              ) : (
                <div className="text-[13px] text-gray-900 v2-md">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.content}</ReactMarkdown>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SectionEditor: React.FC<{ initialText: string; onSave: (t: string) => void; onCancel: () => void }> = ({
  initialText,
  onSave,
  onCancel,
}) => {
  const [text, setText] = useState(initialText);
  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(20, Math.max(4, Math.ceil(text.length / 80)))}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] font-mono focus:border-pink-400 focus:outline-none"
      />
      <div className="flex items-center gap-2 mt-2 text-xs">
        <button type="button" onClick={() => onSave(text)} className="rounded bg-pink-500 hover:bg-pink-600 text-white px-3 py-1 font-semibold">
          Save
        </button>
        <button type="button" onClick={onCancel} className="text-pink-600 hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
};

const SectionReviser: React.FC<{
  current: string;
  instructions: string;
  onChangeInstructions: (t: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  streaming: boolean;
  streamingText?: string;
  error: string | null;
}> = ({ current, instructions, onChangeInstructions, onSubmit, onCancel, streaming, streamingText, error }) => (
  <div className="space-y-2">
    <div className="text-[12px] text-gray-500 italic">Current:</div>
    <div className="text-[13px] text-gray-700 v2-md bg-gray-50 rounded p-2 max-h-32 overflow-y-auto">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{current}</ReactMarkdown>
    </div>
    {!streaming ? (
      <>
        <textarea
          value={instructions}
          onChange={(e) => onChangeInstructions(e.target.value)}
          placeholder="Tell the model what to change — e.g., 'cut to 200 words', 'add a citation to Williams v. Superior Court', 'change tone to more aggressive'."
          rows={3}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] focus:border-pink-400 focus:outline-none"
        />
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={onSubmit}
            disabled={!instructions.trim()}
            className="rounded bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 text-white px-3 py-1 font-semibold"
          >
            Revise
          </button>
          <button type="button" onClick={onCancel} className="text-pink-600 hover:underline">
            Cancel
          </button>
        </div>
      </>
    ) : (
      <div className="text-[13px] text-gray-900 v2-md bg-pink-50 border border-pink-200 rounded p-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-pink-600 mb-1">
          Streaming revision…
        </div>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText ?? '…'}</ReactMarkdown>
        <span className="inline-block animate-pulse">▍</span>
      </div>
    )}
    {error && <div className="text-[11px] text-red-600">Revision error: {error}</div>}
  </div>
);

/**
 * Parse the streamed draft text into sections by `## SECTION: <id>`
 * markers. Returns the sections in document order. Pre-section preamble
 * (the model's narration before the first SECTION marker) is dropped.
 */
function parseDraftSections(text: string): Array<{ sectionId: string; sectionName: string; content: string; wordCount: number }> {
  const re = /## SECTION: (\w+)\s*\n/g;
  const markers: Array<{ id: string; start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    markers.push({ id: m[1], start: m.index, end: re.lastIndex });
  }
  const out: Array<{ sectionId: string; sectionName: string; content: string; wordCount: number }> = [];
  for (let i = 0; i < markers.length; i += 1) {
    const head = markers[i];
    const tailStart = i + 1 < markers.length ? markers[i + 1].start : text.length;
    const content = text.slice(head.end, tailStart).trim();
    out.push({
      sectionId: head.id,
      sectionName: head.id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      content,
      wordCount: content.split(/\s+/).filter((w) => w).length,
    });
  }
  return out;
}

/**
 * Export panel — three buttons (docx / pdf / html) that POST the parsed
 * draft to /api/export-document and trigger a download.
 */
const ExportPanel: React.FC<{ draftText: string; template: TemplateMeta }> = ({ draftText, template }) => {
  const [busy, setBusy] = useState<null | 'docx' | 'pdf' | 'html'>(null);
  const [error, setError] = useState<string | null>(null);

  const onExport = useCallback(
    async (format: 'docx' | 'pdf' | 'html') => {
      setBusy(format);
      setError(null);
      try {
        const sections = parseDraftSections(draftText);
        if (sections.length === 0) {
          setError('Could not parse any sections from the draft.');
          setBusy(null);
          return;
        }
        const doc = {
          id: `v2_doc_${Date.now()}`,
          templateId: template.id,
          templateName: template.name,
          createdAt: new Date().toISOString(),
          sections: sections.map((s) => ({
            sectionId: s.sectionId,
            sectionName: s.sectionName,
            content: s.content,
            wordCount: s.wordCount,
            citations: [],
            generatedAt: new Date().toISOString(),
            revisionCount: 0,
          })),
          formatting: {
            fontFamily: 'Times New Roman',
            fontSize: 12,
            lineSpacing: template.id === 'legal_memo' ? 'double' : 'single',
            margins: { top: 1, bottom: 1, left: 1, right: 1 },
            pageNumbers: template.id === 'legal_memo' || template.id === 'motion_compel',
          },
        };
        const resp = await fetch('/api/export-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document: doc, format }),
        });
        if (!resp.ok) {
          const errBody = await resp.text().catch(() => '');
          setError(`Export failed: HTTP ${resp.status} ${errBody.slice(0, 120)}`);
          setBusy(null);
          return;
        }
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${template.id}-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [draftText, template],
  );

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">Export</h3>
      </div>
      <div className="flex items-center gap-2">
        {(['docx', 'pdf', 'html'] as const).map((fmt) => (
          <button
            key={fmt}
            type="button"
            onClick={() => onExport(fmt)}
            disabled={busy !== null}
            className="rounded-full bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 text-white text-xs font-semibold px-3 py-1.5"
          >
            {busy === fmt ? 'Generating…' : `Export ${fmt.toUpperCase()}`}
          </button>
        ))}
      </div>
      {error && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>
      )}
    </div>
  );
};

/**
 * Verification panel — appears after a draft completes. Triggers the
 * Phase 3 verifier sub-agent over every citation found in the streamed
 * draft text. Renders per-citation rows progressively: pending →
 * verified / fake / error. Mean latency ~18s/citation, so the user
 * sees citations resolve one-by-one over a few minutes.
 */
const VerificationPanel: React.FC<{
  draftText: string;
  verifyHook: ReturnType<typeof useV2VerifyStream>;
}> = ({ draftText, verifyHook }) => {
  const { state, verify, reset } = verifyHook;

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Citation Verification</h3>
        {!state.isStreaming && !state.done && !state.manifest && (
          <button
            type="button"
            onClick={() => void verify(draftText)}
            className="rounded-full bg-pink-500 hover:bg-pink-600 text-white text-xs font-semibold px-3 py-1.5"
          >
            Verify Citations
          </button>
        )}
        {(state.done || state.isStreaming) && (
          <button
            type="button"
            onClick={() => {
              reset();
              void verify(draftText);
            }}
            className="text-xs text-pink-600 hover:underline"
            disabled={state.isStreaming}
          >
            Re-run
          </button>
        )}
      </div>

      {!state.manifest && !state.isStreaming && (
        <p className="text-xs text-gray-500">
          Click <strong>Verify Citations</strong> to run an adversarial check on every
          case citation in this draft. Each citation is verified by a separate
          agent that uses CourtListener and CEB; ~18s per citation.
        </p>
      )}

      {state.manifest && state.manifest.length === 0 && (
        <p className="text-xs text-gray-500">No case citations found in the draft.</p>
      )}

      {state.verdicts.length > 0 && (
        <div className="space-y-1.5">
          {state.verdicts.map((v) => (
            <VerdictRow key={v.index} verdict={v} />
          ))}
        </div>
      )}

      {state.done && (
        <>
          <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-700 flex items-center justify-between">
            <div>
              <strong className="text-gray-900">{state.done.verified}</strong> verified ·{' '}
              <strong className="text-gray-900">{state.done.fake}</strong> not verified ·{' '}
              <strong className="text-gray-900">{state.done.total}</strong> total
            </div>
            <div className="text-gray-400">
              {Math.round(state.done.elapsed_ms / 1000)}s
            </div>
          </div>
          {/* P4.1 — confidence gate verdict */}
          <ConfidenceChip verdicts={state.verdicts} />
        </>
      )}

      {state.error && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          Verification error — {state.error.message}
        </div>
      )}
    </div>
  );
};

/**
 * ConfidenceChip — surfaces the aggregate confidence gate (P4.1) after
 * verification completes. Color-coded badge + caveat.
 */
const ConfidenceChip: React.FC<{ verdicts: V2Verdict[] }> = ({ verdicts }) => {
  const result = useMemo(() => gateOnVerdicts(verdicts), [verdicts]);
  const palette: Record<typeof result.level, string> = {
    high: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    medium: 'bg-amber-50 text-amber-800 border-amber-200',
    low: 'bg-orange-50 text-orange-800 border-orange-200',
    fail: 'bg-red-50 text-red-800 border-red-200',
  };
  const icon: Record<typeof result.level, string> = {
    high: '✓',
    medium: '⚠',
    low: '⚠',
    fail: '✗',
  };
  return (
    <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${palette[result.level]}`}>
      <div className="flex items-center gap-2 font-semibold">
        <span>{icon[result.level]}</span>
        <span className="uppercase tracking-wider">Confidence: {result.level}</span>
        {typeof result.score === 'number' && (
          <span className="font-mono text-[10px] opacity-70">({result.score.toFixed(2)})</span>
        )}
      </div>
      <div className="mt-0.5 text-[11px] opacity-90">{result.caveat}</div>
    </div>
  );
};

const VerdictRow: React.FC<{ verdict: V2Verdict }> = ({ verdict }) => {
  if (verdict.status === 'pending') {
    return (
      <div className="flex items-start gap-2 text-xs text-gray-500">
        <span className="animate-spin">⟳</span>
        <span className="flex-1 font-mono text-[11px]">{verdict.citation.slice(0, 100)}</span>
      </div>
    );
  }
  if (verdict.status === 'error') {
    return (
      <div className="flex items-start gap-2 text-xs text-red-700">
        <span>✗</span>
        <div className="flex-1">
          <div className="font-mono text-[11px]">{verdict.citation.slice(0, 100)}</div>
          <div className="text-[11px] text-red-600">Error: {verdict.error}</div>
        </div>
      </div>
    );
  }
  const isReal = verdict.status === 'real';
  const isAmbiguous = verdict.status === 'ambiguous';
  const tag = isReal ? '✓' : isAmbiguous ? '?' : '✗';
  const color = isReal
    ? 'text-emerald-700'
    : isAmbiguous
    ? 'text-amber-700'
    : 'text-red-700';
  const bg = isReal
    ? 'bg-emerald-50 border-emerald-200'
    : isAmbiguous
    ? 'bg-amber-50 border-amber-200'
    : 'bg-red-50 border-red-200';
  return (
    <div className={`flex items-start gap-2 text-xs rounded border ${bg} px-2 py-1.5`}>
      <span className={`${color} font-bold`}>{tag}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] text-gray-700 truncate">{verdict.citation}</span>
          {typeof verdict.confidence === 'number' && (
            <span className="text-[10px] text-gray-400 shrink-0">
              conf {verdict.confidence.toFixed(2)}
            </span>
          )}
          {isAmbiguous && (
            <span className="text-[10px] font-semibold text-amber-800 shrink-0">VERIFY MANUALLY</span>
          )}
        </div>
        {verdict.case_name && verdict.match_url && isReal && (
          <a
            href={verdict.match_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-pink-600 underline hover:text-pink-700"
          >
            {verdict.case_name}
          </a>
        )}
        {verdict.reasoning && (
          <div className="text-[11px] text-gray-600 mt-0.5">{verdict.reasoning}</div>
        )}
      </div>
    </div>
  );
};

/**
 * Expected section IDs per template — mirrors EXPECTED_SECTIONS in
 * api/agent/draft-stream.ts. Used by SectionProgressBar.
 */
function getExpectedSections(templateId: string): string[] {
  switch (templateId) {
    case 'legal_memo':
      return ['header', 'question_presented', 'brief_answer', 'facts', 'analysis', 'conclusion'];
    case 'demand_letter':
      return ['letterhead', 'introduction', 'factual_background', 'legal_basis', 'demand', 'consequences', 'closing'];
    case 'client_letter':
      return ['letterhead', 'introduction', 'facts_summary', 'legal_analysis', 'options', 'next_steps', 'closing'];
    case 'motion_compel':
      return ['caption', 'notice_of_motion', 'mpa_introduction', 'mpa_facts', 'mpa_argument', 'mpa_prayer', 'declaration', 'separate_statement', 'pos_reference', 'signature'];
    default:
      return [];
  }
}

/**
 * Section progress bar (P3.5) — for each expected section, render a
 * tick that fills as the model emits `## SECTION: <id>` for that
 * section. Adapted from V1's OrchestrationVisual concept.
 */
const SectionProgressBar: React.FC<{ draftText: string; expectedSections: string[] }> = ({
  draftText,
  expectedSections,
}) => {
  if (expectedSections.length === 0) return null;
  // Build emitted-set from the streaming text
  const emitted = new Set<string>();
  const re = /## SECTION: (\w+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(draftText)) !== null) emitted.add(m[1]);
  const completed = expectedSections.filter((s) => emitted.has(s)).length;
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-700">
          Section progress
        </div>
        <div className="text-[11px] text-gray-500 font-mono">
          {completed} / {expectedSections.length}
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        {expectedSections.map((s) => {
          const done = emitted.has(s);
          const inProgress = !done && emitted.size === expectedSections.indexOf(s);
          return (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-sm ${
                done ? 'bg-pink-500' : inProgress ? 'bg-pink-300 animate-pulse' : 'bg-gray-200'
              }`}
              title={s}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
        <span className="truncate" title={expectedSections.join(', ')}>
          {expectedSections[0]?.replace(/_/g, ' ')}
        </span>
        <span className="truncate" title={expectedSections[expectedSections.length - 1]}>
          {expectedSections[expectedSections.length - 1]?.replace(/_/g, ' ')}
        </span>
      </div>
    </div>
  );
};

const ToolPill: React.FC<{ tool: { name: string; status: string; elapsed_ms?: number } }> = ({
  tool,
}) => {
  const name = toolHumanName(tool.name);
  if (tool.status === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700 border border-blue-200">
        <span className="animate-spin">⟳</span> Searching {name}…
      </span>
    );
  }
  if (tool.status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs text-red-700 border border-red-200">
        ✗ {name} failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1 text-xs text-gray-700 border border-gray-200">
      ✓ {name}
      {typeof tool.elapsed_ms === 'number' && ` · ${Math.round(tool.elapsed_ms)}ms`}
    </span>
  );
};

export default V2DraftPage;
