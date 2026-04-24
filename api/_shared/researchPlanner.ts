/**
 * Research Planner
 *
 * Two Claude passes that bracket deterministic retrieval:
 *
 *   1. extractEntities(query)       — structured plan before retrieval
 *   2. identifyGaps(query, state)   — gap analysis after the first retrieval
 *
 * Both calls run on Bedrock Haiku (BEDROCK_RESEARCH_MODEL) and return JSON.
 * They see only public-legal terms — never raw client-confidential facts —
 * which is why the prompts are explicit about that constraint.
 *
 * Each pass fails *open* on any error: if Claude is unreachable or returns
 * malformed JSON, callers get an empty plan and retrieval still runs
 * deterministically. We never silently mask the failure; the caller logs it
 * and the ResearchPackage falls back to the one-pass behavior.
 */

import { generateText, hasBedrockProviderCredentials } from './anthropicBedrock.js';
import { BedrockConfigError, resolveBedrockModel } from './bedrockModels.js';

export interface ExtractedEntities {
  statutes: Array<{ code: string; section: string }>;
  cases: string[];
  legal_concepts: string[];
  practice_areas: Array<
    | 'trusts_estates'
    | 'family_law'
    | 'business_litigation'
    | 'business_entities'
    | 'business_transactions'
  >;
  legislative_terms: string[];
  legislative_session_year?: string;
  is_current_law_query: boolean;
}

export interface GapPlan {
  statute_followups: Array<{ code: string; section: string }>;
  case_followup_queries: string[];
  legislative_followup_queries: string[];
  ceb_followup_queries: string[];
  rationale: string;
}

const ENTITY_SYSTEM_PROMPT = `You are a California legal research assistant. Given a sanitized public-legal research question, extract structured entities that will steer downstream retrieval.

Rules:
- Only extract information that is public-legal in nature (statute citations, case names, legal concepts, practice areas, legislative terms).
- Do NOT repeat or paraphrase any personal data, client names, addresses, or other PII if any appear — just ignore them.
- If a field has no value, return an empty array (or false for booleans).
- legislative_session_year should be a four-digit year string if the question asks about a specific legislative session; otherwise omit it.
- is_current_law_query is true when the question explicitly asks about recent, new, current, or 2024/2025/2026 laws/bills/amendments.

Return JSON only. Schema:
{
  "statutes": [{"code": "Family Code", "section": "1615"}],
  "cases": ["People v. Smith"],
  "legal_concepts": ["premarital agreement", "voluntariness"],
  "practice_areas": ["family_law"],
  "legislative_terms": ["premarital agreement"],
  "legislative_session_year": "2025",
  "is_current_law_query": false
}`;

const GAP_SYSTEM_PROMPT = `You are a California legal research assistant performing a gap analysis after an initial retrieval pass.

Inputs:
- The original public-legal research question.
- A summary of what was found in each source.

Task:
- Identify what is missing or thin relative to the question.
- Propose follow-up searches strictly for public-legal retrieval.
- Never invent citations; only suggest search terms or statute lookups.
- If a source already looks sufficient, return an empty array for that field.

Return JSON only. Schema:
{
  "statute_followups": [{"code": "Probate Code", "section": "859"}],
  "case_followup_queries": ["breach of fiduciary duty trustee California"],
  "legislative_followup_queries": ["California AB electric bicycle 2025"],
  "ceb_followup_queries": ["undue influence elder financial abuse"],
  "rationale": "one sentence explaining what was missing"
}`;

function normalizeModel(role: 'research'): string | null {
  try {
    return resolveBedrockModel(role).id;
  } catch (err) {
    if (err instanceof BedrockConfigError) {
      console.error('Research planner Bedrock config error:', err.message);
    } else {
      console.error('Research planner Bedrock config error:', err);
    }
    return null;
  }
}

function safeParseJSON<T>(text: string, fallback: T): T {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return fallback;
  }
}

export const EMPTY_ENTITIES: ExtractedEntities = {
  statutes: [],
  cases: [],
  legal_concepts: [],
  practice_areas: [],
  legislative_terms: [],
  is_current_law_query: false,
};

export const EMPTY_GAP_PLAN: GapPlan = {
  statute_followups: [],
  case_followup_queries: [],
  legislative_followup_queries: [],
  ceb_followup_queries: [],
  rationale: '',
};

/**
 * Pre-retrieval Claude pass. Returns EMPTY_ENTITIES on any failure.
 */
export async function extractEntities(query: string): Promise<ExtractedEntities> {
  if (!hasBedrockProviderCredentials()) return EMPTY_ENTITIES;
  const model = normalizeModel('research');
  if (!model) return EMPTY_ENTITIES;

  try {
    const response = await generateText({
      model,
      messages: [{ role: 'user', content: `Research question:\n${query.trim()}\n\nReturn JSON only.` }],
      systemInstruction: ENTITY_SYSTEM_PROMPT,
      temperature: 0,
      maxOutputTokens: 800,
      responseMimeType: 'application/json',
    });

    const parsed = safeParseJSON<Partial<ExtractedEntities>>(response.text, {});
    return {
      statutes: Array.isArray(parsed.statutes)
        ? parsed.statutes.filter(
            (s): s is { code: string; section: string } =>
              !!s && typeof s.code === 'string' && typeof s.section === 'string'
          )
        : [],
      cases: Array.isArray(parsed.cases) ? parsed.cases.filter((c) => typeof c === 'string') : [],
      legal_concepts: Array.isArray(parsed.legal_concepts)
        ? parsed.legal_concepts.filter((c) => typeof c === 'string')
        : [],
      practice_areas: Array.isArray(parsed.practice_areas)
        ? (parsed.practice_areas.filter((p) =>
            [
              'trusts_estates',
              'family_law',
              'business_litigation',
              'business_entities',
              'business_transactions',
            ].includes(p as string)
          ) as ExtractedEntities['practice_areas'])
        : [],
      legislative_terms: Array.isArray(parsed.legislative_terms)
        ? parsed.legislative_terms.filter((t) => typeof t === 'string')
        : [],
      legislative_session_year:
        typeof parsed.legislative_session_year === 'string' &&
        /^\d{4}$/.test(parsed.legislative_session_year)
          ? parsed.legislative_session_year
          : undefined,
      is_current_law_query: parsed.is_current_law_query === true,
    };
  } catch (err) {
    console.error('extractEntities error:', err);
    return EMPTY_ENTITIES;
  }
}

export interface RetrievalSnapshot {
  cebCount: number;
  caseCount: number;
  statuteCount: number;
  legislativeCount: number;
  cebExcerpts: string[];
  caseHeadings: string[];
  statuteHeadings: string[];
  legislativeHeadings: string[];
}

/**
 * Post-retrieval Claude pass. Returns EMPTY_GAP_PLAN on any failure.
 */
export async function identifyGaps(
  query: string,
  entities: ExtractedEntities,
  snapshot: RetrievalSnapshot
): Promise<GapPlan> {
  if (!hasBedrockProviderCredentials()) return EMPTY_GAP_PLAN;
  const model = normalizeModel('research');
  if (!model) return EMPTY_GAP_PLAN;

  const prompt = `Research question:
${query.trim()}

Extracted entities (from the planner pass):
${JSON.stringify(entities, null, 2)}

Initial retrieval results:
- CEB: ${snapshot.cebCount} source(s)
${snapshot.cebExcerpts.slice(0, 3).map((e) => `  • ${e.substring(0, 160)}`).join('\n') || '  • (none)'}
- Cases: ${snapshot.caseCount}
${snapshot.caseHeadings.slice(0, 3).map((e) => `  • ${e.substring(0, 160)}`).join('\n') || '  • (none)'}
- Statutes: ${snapshot.statuteCount}
${snapshot.statuteHeadings.slice(0, 3).map((e) => `  • ${e.substring(0, 160)}`).join('\n') || '  • (none)'}
- Legislation: ${snapshot.legislativeCount}
${snapshot.legislativeHeadings.slice(0, 3).map((e) => `  • ${e.substring(0, 160)}`).join('\n') || '  • (none)'}

Identify gaps and propose follow-up queries. Return JSON only.`;

  try {
    const response = await generateText({
      model,
      messages: [{ role: 'user', content: prompt }],
      systemInstruction: GAP_SYSTEM_PROMPT,
      temperature: 0,
      maxOutputTokens: 700,
      responseMimeType: 'application/json',
    });

    const parsed = safeParseJSON<Partial<GapPlan>>(response.text, {});
    return {
      statute_followups: Array.isArray(parsed.statute_followups)
        ? parsed.statute_followups.filter(
            (s): s is { code: string; section: string } =>
              !!s && typeof s.code === 'string' && typeof s.section === 'string'
          )
        : [],
      case_followup_queries: Array.isArray(parsed.case_followup_queries)
        ? parsed.case_followup_queries.filter((q) => typeof q === 'string' && q.length > 0)
        : [],
      legislative_followup_queries: Array.isArray(parsed.legislative_followup_queries)
        ? parsed.legislative_followup_queries.filter((q) => typeof q === 'string' && q.length > 0)
        : [],
      ceb_followup_queries: Array.isArray(parsed.ceb_followup_queries)
        ? parsed.ceb_followup_queries.filter((q) => typeof q === 'string' && q.length > 0)
        : [],
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale : '',
    };
  } catch (err) {
    console.error('identifyGaps error:', err);
    return EMPTY_GAP_PLAN;
  }
}

/**
 * Deterministic helper for callers that do not have Bedrock credentials
 * available (tests, fallback paths). Pulls statute lookups, practice areas,
 * and the current-law heuristic from plain regex + keyword scans so the
 * agent can still steer retrieval without a live Claude call.
 */
export function extractEntitiesHeuristic(query: string): ExtractedEntities {
  const text = query.toLowerCase();
  const statutes: ExtractedEntities['statutes'] = [];
  const seen = new Set<string>();
  const statutePattern =
    /\b(Family|Probate|Civil|Penal|Government|Corporations|Evidence|Labor|Code of Civil Procedure|Welfare and Institutions|Business and Professions)\s+Code\s*(?:§|section)?\s*(\d+(?:\.\d+)?)/gi;
  let match: RegExpExecArray | null;
  while ((match = statutePattern.exec(query)) !== null) {
    const key = `${match[1]}:${match[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    statutes.push({ code: `${match[1]} Code`, section: match[2] });
  }

  const practice_areas: ExtractedEntities['practice_areas'] = [];
  if (/(trust|estate|probate|will|conservatorship)/.test(text)) practice_areas.push('trusts_estates');
  if (/(family|divorce|custody|support|domestic partner|parentage|premarital)/.test(text))
    practice_areas.push('family_law');
  if (/(litigation|discovery|motion|deposition|complaint)/.test(text))
    practice_areas.push('business_litigation');
  if (/(corporation|llc|partnership|shareholder|entity)/.test(text))
    practice_areas.push('business_entities');
  if (/(transaction|merger|acquisition|contract|agreement)/.test(text))
    practice_areas.push('business_transactions');

  const legislative_terms: string[] = [];
  const legWords = /(bill|legislation|AB\s?\d+|SB\s?\d+|ACA\s?\d+|SCA\s?\d+|statute|amendment)/gi;
  const legMatches = query.match(legWords);
  if (legMatches) legislative_terms.push(...Array.from(new Set(legMatches.map((m) => m.trim()))));

  const sessionYearMatch = query.match(/\b(20\d{2})\b/);

  return {
    statutes,
    cases: [],
    legal_concepts: [],
    practice_areas: Array.from(new Set(practice_areas)),
    legislative_terms,
    legislative_session_year: sessionYearMatch ? sessionYearMatch[1] : undefined,
    is_current_law_query:
      /(new law|recent law|recently|current|currently|202[4-9]|pending|latest|amended)/.test(text),
  };
}

/**
 * Merge a heuristic entity pack with a Claude-extracted one, preferring the
 * Claude fields where they are non-empty but never dropping heuristic hits.
 */
export function mergeEntities(
  heuristic: ExtractedEntities,
  llm: ExtractedEntities
): ExtractedEntities {
  const dedupe = <T>(a: T[], b: T[], key: (v: T) => string): T[] => {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const v of [...a, ...b]) {
      const k = key(v);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(v);
    }
    return out;
  };

  return {
    statutes: dedupe(heuristic.statutes, llm.statutes, (s) => `${s.code.toLowerCase()}:${s.section}`),
    cases: dedupe(heuristic.cases, llm.cases, (s) => s.toLowerCase()),
    legal_concepts: dedupe(
      heuristic.legal_concepts,
      llm.legal_concepts,
      (s) => s.toLowerCase()
    ),
    practice_areas: Array.from(
      new Set([...heuristic.practice_areas, ...llm.practice_areas])
    ) as ExtractedEntities['practice_areas'],
    legislative_terms: dedupe(
      heuristic.legislative_terms,
      llm.legislative_terms,
      (s) => s.toLowerCase()
    ),
    legislative_session_year: llm.legislative_session_year || heuristic.legislative_session_year,
    is_current_law_query: heuristic.is_current_law_query || llm.is_current_law_query,
  };
}
