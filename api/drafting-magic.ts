/**
 * Drafting Magic drafter endpoint.
 *
 * This route accepts ONLY browser-sanitized drafting packets. The browser
 * tokenizes source documents and attorney instructions before POSTing; this
 * server route then enforces the Accuracy flow boundary, runs the deterministic
 * raw-PII backstop, and sends tokenized packet text to the Bedrock drafter.
 *
 * The response intentionally remains tokenized. Rehydration happens only in
 * the attorney's browser using the local token map.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  generateText,
  getErrorDetails,
  hasBedrockProviderCredentials,
} from './_shared/anthropicBedrock.js';
import { ACCURACY_ALLOWED, enforceFlow, rejectFlow } from './_shared/flowPolicy.js';
import {
  BedrockConfigError,
  assertNoPromptCacheMetadata,
  resolveBedrockModel,
} from './_shared/bedrockModels.js';
import { rejectWithBackstop, scanRequest } from './_shared/sanitization/guard.js';
import { buildAuditRecord, writeAuditRecord } from './_shared/auditLog.js';

export const config = {
  maxDuration: 60,
};

type DraftStatus = 'Reviewed' | 'Needs review' | 'Generated';
type ChecklistStatus = 'Satisfied' | 'Partial' | 'Needs review';
type RowRecommendation = 'Keep' | 'Revise' | 'Discard' | 'Add' | 'Review';

interface DraftingMagicSourcePayload {
  id: string;
  name: string;
  role: string;
  included: boolean;
  base: boolean;
  text: string;
  description?: string;
  format?: string;
}

interface DraftingMagicRowPayload {
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

interface DraftingMagicStrategyPayload {
  outputType: string;
  baseStrategy: string;
  tone: string;
  citations: string;
}

interface DraftingMagicRequestPayload {
  attorneyUpdate: string;
  sources: DraftingMagicSourcePayload[];
  rows: DraftingMagicRowPayload[];
  strategy: DraftingMagicStrategyPayload;
  sanitization?: {
    method?: 'opf' | 'heuristic' | 'mixed';
    tokenCount?: number;
  };
}

interface GeneratedDraftSection {
  id: string;
  title: string;
  status: DraftStatus;
  lineage: string;
  requirements: string;
  content: string;
}

interface GeneratedComplianceItem {
  id: string;
  requirement: string;
  location: string;
  status: ChecklistStatus;
  evidence: string;
}

interface DraftingMagicModelResponse {
  sections: GeneratedDraftSection[];
  checklist: GeneratedComplianceItem[];
}

const DRAFTER_TIMEOUT_MS = Number(process.env.BEDROCK_DRAFTER_TIMEOUT_MS || 55000);
const MAX_SOURCE_CHARS = Number(process.env.DRAFTING_MAGIC_MAX_SOURCE_CHARS || 50000);
const MAX_TOTAL_CHARS = Number(process.env.DRAFTING_MAGIC_MAX_TOTAL_CHARS || 180000);

function asString(value: unknown, maxLength = 20000): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function asBoolean(value: unknown): boolean {
  return Boolean(value);
}

function asRecommendation(value: unknown): RowRecommendation {
  return ['Keep', 'Revise', 'Discard', 'Add', 'Review'].includes(String(value))
    ? (value as RowRecommendation)
    : 'Review';
}

function normalizeRequest(body: Record<string, unknown>): DraftingMagicRequestPayload {
  const rawSources = Array.isArray(body.sources) ? body.sources : [];
  const rawRows = Array.isArray(body.rows) ? body.rows : [];
  const rawStrategy = body.strategy && typeof body.strategy === 'object'
    ? body.strategy as Record<string, unknown>
    : {};
  const rawSanitization = body.sanitization && typeof body.sanitization === 'object'
    ? body.sanitization as Record<string, unknown>
    : {};

  const sources = rawSources.slice(0, 8).map((source, index) => {
    const item = source && typeof source === 'object' ? source as Record<string, unknown> : {};
    return {
      id: asString(item.id, 80) || `source-${index + 1}`,
      name: asString(item.name, 240) || `Source ${index + 1}`,
      role: asString(item.role, 80) || 'Source',
      included: asBoolean(item.included),
      base: asBoolean(item.base),
      text: asString(item.text, MAX_SOURCE_CHARS),
      description: asString(item.description, 2000),
      format: asString(item.format, 40),
    };
  });

  const rows = rawRows.slice(0, 40).map((row, index) => {
    const item = row && typeof row === 'object' ? row as Record<string, unknown> : {};
    return {
      id: asString(item.id, 80) || `row-${index + 1}`,
      issue: asString(item.issue, 300) || `Issue ${index + 1}`,
      rowType: asString(item.rowType, 160),
      sourceALabel: asString(item.sourceALabel, 100),
      sourceA: asString(item.sourceA, 3000),
      sourceBLabel: asString(item.sourceBLabel, 100),
      sourceB: asString(item.sourceB, 3000),
      sourceCLabel: asString(item.sourceCLabel, 100),
      sourceC: asString(item.sourceC, 3000),
      newLawImpact: asString(item.newLawImpact, 3000),
      recommendation: asRecommendation(item.recommendation),
      rationale: asString(item.rationale, 3000),
      confidence: ['High', 'Medium', 'Low'].includes(String(item.confidence))
        ? item.confidence as 'High' | 'Medium' | 'Low'
        : 'Medium',
      approved: asBoolean(item.approved),
    };
  });

  return {
    attorneyUpdate: asString(body.attorneyUpdate, 12000),
    sources,
    rows,
    strategy: {
      outputType: asString(rawStrategy.outputType, 120) || 'Estate plan review memo',
      baseStrategy: asString(rawStrategy.baseStrategy, 120) || 'Packet reconciliation',
      tone: asString(rawStrategy.tone, 120) || 'Attorney working draft',
      citations: asString(rawStrategy.citations, 120) || 'Attorney checklist',
    },
    sanitization: {
      method: ['opf', 'heuristic', 'mixed'].includes(String(rawSanitization.method))
        ? rawSanitization.method as 'opf' | 'heuristic' | 'mixed'
        : undefined,
      tokenCount: typeof rawSanitization.tokenCount === 'number' ? rawSanitization.tokenCount : undefined,
    },
  };
}

function buildDrafterPrompt(input: DraftingMagicRequestPayload): string {
  const includedSources = input.sources.filter((source) => source.included);
  const baseSource = includedSources.find((source) => source.base) || includedSources[0];
  const sourceBlock = includedSources
    .map((source, index) => {
      const text = source.text || source.description || 'No extracted text supplied.';
      return [
        `SOURCE ${index + 1}`,
        `id: ${source.id}`,
        `role: ${source.role}`,
        `name: ${source.name}`,
        `base: ${source.id === baseSource?.id ? 'yes' : 'no'}`,
        `format: ${source.format || 'unknown'}`,
        'text:',
        text,
      ].join('\n');
    })
    .join('\n\n---\n\n');

  const matrixBlock = input.rows
    .map((row, index) => {
      return [
        `MATRIX ROW ${index + 1}: ${row.issue}`,
        `type: ${row.rowType}`,
        `approved: ${row.approved ? 'yes' : 'no'}`,
        `recommendation: ${row.recommendation}`,
        `confidence: ${row.confidence}`,
        `${row.sourceALabel}: ${row.sourceA}`,
        `${row.sourceBLabel}: ${row.sourceB}`,
        `${row.sourceCLabel}: ${row.sourceC}`,
        `new law / attorney update impact: ${row.newLawImpact}`,
        `rationale: ${row.rationale}`,
      ].join('\n');
    })
    .join('\n\n');

  return [
    'Drafting Magic sanitized packet request.',
    '',
    'Important confidentiality rules:',
    '- The packet below is already tokenized by the attorney browser. Preserve tokens such as CLIENT_001, DATE_001, ADDRESS_001, EMAIL_001, PHONE_001 exactly.',
    '- Do not invent names, addresses, account numbers, or facts that are not present in the packet.',
    '- Do not attempt to replace tokens with plausible real-world values.',
    '- Draft for attorney review only. Flag unresolved legal or factual choices instead of silently deciding them.',
    '',
    'Output requirements:',
    '- Return strict JSON only. No markdown fences, no prose outside JSON.',
    '- JSON shape: {"sections":[{"id","title","status","lineage","requirements","content"}],"checklist":[{"id","requirement","location","status","evidence"}]}',
    '- section.status must be one of: Reviewed, Needs review, Generated.',
    '- checklist.status must be one of: Satisfied, Partial, Needs review.',
    '- Include exactly 4 draft sections and 6 checklist items.',
    '- Keep each section content under 90 words.',
    '- Make each section traceable to source roles and approved/open matrix decisions.',
    '',
    `Drafting strategy: ${input.strategy.outputType}; ${input.strategy.baseStrategy}; ${input.strategy.tone}; ${input.strategy.citations}.`,
    `Sanitization method reported by browser: ${input.sanitization?.method || 'unknown'}.`,
    '',
    'Attorney update / new law instruction:',
    input.attorneyUpdate || 'No attorney update supplied.',
    '',
    'Source packet:',
    sourceBlock || 'No included sources.',
    '',
    'Comparison matrix:',
    matrixBlock || 'No comparison matrix supplied.',
  ].join('\n');
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf('{');
    const last = trimmed.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) throw new Error('Model response was not JSON.');
    return JSON.parse(trimmed.slice(first, last + 1));
  }
}

function normalizeDraftResponse(value: unknown): DraftingMagicModelResponse {
  if (!value || typeof value !== 'object') {
    throw new Error('Drafter response was not an object.');
  }
  const payload = value as { sections?: unknown; checklist?: unknown };
  const rawSections = Array.isArray(payload.sections) ? payload.sections : [];
  const rawChecklist = Array.isArray(payload.checklist) ? payload.checklist : [];

  const sections = rawSections.slice(0, 8).map((section, index) => {
    const item = section && typeof section === 'object' ? section as Record<string, unknown> : {};
    const status = ['Reviewed', 'Needs review', 'Generated'].includes(String(item.status))
      ? item.status as DraftStatus
      : 'Generated';
    return {
      id: asString(item.id, 80) || `generated-section-${index + 1}`,
      title: asString(item.title, 160) || `Generated section ${index + 1}`,
      status,
      lineage: asString(item.lineage, 1000),
      requirements: asString(item.requirements, 1000),
      content: asString(item.content, 20000),
    };
  }).filter((section) => section.content.length > 0);

  const checklist = rawChecklist.slice(0, 12).map((item, index) => {
    const entry = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const status = ['Satisfied', 'Partial', 'Needs review'].includes(String(entry.status))
      ? entry.status as ChecklistStatus
      : 'Needs review';
    return {
      id: asString(entry.id, 80) || `generated-check-${index + 1}`,
      requirement: asString(entry.requirement, 300) || `Review item ${index + 1}`,
      location: asString(entry.location, 300) || 'Generated draft',
      status,
      evidence: asString(entry.evidence, 3000),
    };
  });

  if (!sections.length) {
    throw new Error('Drafter response did not include usable sections.');
  }

  return { sections, checklist };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    const flowResult = enforceFlow(req.body, ACCURACY_ALLOWED);
    if (rejectFlow(res, flowResult)) return;

    const input = normalizeRequest(req.body || {});
    const includedSources = input.sources.filter((source) => source.included);
    if (!includedSources.length) {
      res.status(400).json({ error: 'missing_sources', message: 'Include at least one source document before drafting.' });
      return;
    }

    const prompt = buildDrafterPrompt(input);
    if (prompt.length > MAX_TOTAL_CHARS) {
      res.status(413).json({
        error: 'packet_too_large',
        message: 'The sanitized drafting packet is too large. Remove unused documents or shorten source excerpts.',
      });
      return;
    }

    const backstop = scanRequest(prompt);
    if (rejectWithBackstop(res, backstop)) {
      writeAuditRecord(
        buildAuditRecord({
          route: 'drafting-magic',
          sanitizedPrompt: prompt,
          flowType: flowResult.flow,
          backstopTriggered: true,
          backstopCategories: 'categories' in backstop ? backstop.categories : undefined,
          statusCode: 400,
        })
      );
      return;
    }

    if (!hasBedrockProviderCredentials()) {
      res.status(500).json({
        error: 'bedrock_config_error',
        message: 'AWS Bedrock credentials are not configured for Drafting Magic.',
      });
      return;
    }

    let drafterModel;
    try {
      drafterModel = resolveBedrockModel('drafter');
    } catch (err) {
      if (err instanceof BedrockConfigError) {
        console.error('Bedrock config error:', err.message);
        res.status(500).json({ error: 'bedrock_config_error', message: err.message });
        return;
      }
      throw err;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DRAFTER_TIMEOUT_MS);
    const startedAt = Date.now();
    try {
      const requestPayload = {
        model: drafterModel.id,
        messages: [{ role: 'user' as const, content: prompt }],
        systemInstruction:
          'You are Drafting Magic, a California estate-planning drafting assistant for attorneys. You receive tokenized confidential packets and produce attorney-review draft JSON while preserving every confidentiality token exactly.',
        temperature: 0.15,
        maxOutputTokens: Number(process.env.BEDROCK_DRAFTER_MAX_TOKENS || 2200),
        abortSignal: controller.signal,
      };
      assertNoPromptCacheMetadata(requestPayload, 'drafting-magic');
      const response = await generateText(requestPayload);
      const parsed = normalizeDraftResponse(extractJson(response.text));

      res.status(200).json({
        draftPackage: parsed,
        model: drafterModel.id,
        provider: response.providerMode,
        sanitization: input.sanitization,
      });
      writeAuditRecord(
        buildAuditRecord({
          route: 'drafting-magic',
          sanitizedPrompt: prompt,
          flowType: flowResult.flow,
          model: drafterModel.id,
          sourceProviders: ['bedrock'],
          latencyMs: Date.now() - startedAt,
          statusCode: 200,
        })
      );
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: unknown) {
    console.error('Drafting Magic API error:', getErrorDetails(err).message);
    const { message, status } = getErrorDetails(err);
    const lowerMessage = message.toLowerCase();
    let statusCode = status || 500;
    let userMessage = message;

    if (lowerMessage.includes('timeout') || lowerMessage.includes('abort')) {
      statusCode = 504;
      userMessage = 'Drafting Magic timed out while generating the packet draft.';
    }

    res.status(statusCode).json({
      error: 'drafting_magic_failed',
      message: userMessage || 'Drafting Magic failed.',
    });
  }
}
