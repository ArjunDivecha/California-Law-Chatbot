/**
 * Phase 3 — Citation verifier sub-agent.
 *
 * Per plan §Phase 3: "Adversarial verification as a separate agent-loop
 * invocation. Separate conversation per verification run, fresh `messages`
 * array, no shared context with workbench."
 *
 * Architecture:
 *   - Invokes anthropic.messages.create with a NEW conversation (no session
 *     state, no shared history with the main workbench).
 *   - System prompt is the verification-specific Skill below.
 *   - Tools: citation_verify, courtlistener_search, ceb_search.
 *     web_search is omitted — verification must rely on deterministic
 *     case-law sources, never on general web content.
 *   - Output schema: JSON {status, case_name?, confidence, reasoning}.
 *   - The MODEL applies judgment to reject mismatched search hits
 *     (e.g., CourtListener returning "John Doe v. Gary Settle" for a
 *     query about "Hendricks v. California Probate Bureau" — the
 *     baseline tool blindly accepts that; the sub-agent rejects it).
 *
 * Why a sub-agent vs. extending citation_verify:
 *   - The judgment step (does this CL hit actually correspond to the
 *     citation in the query?) is semantic, not syntactic. Regex / fuzzy
 *     string matching breaks on parallel reporters and party-name
 *     reorderings. The model can read both citations and decide.
 *   - The verifier needs to be defensible in deposition — "an LLM with
 *     verification-specific instructions and read-only access to
 *     CourtListener / CEB confirmed each citation" is a clearer story
 *     than "we ran a regex against CourtListener's search API."
 *
 * Used by:
 *   - scripts/phase3-eval.mjs (evaluation harness)
 *   - Future: a `verify` endpoint or workflow that lets attorneys paste
 *     a passage and get a verification report.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  CEB_SEARCH_TOOL_DEFINITION,
  COURTLISTENER_SEARCH_TOOL_DEFINITION,
  CITATION_VERIFY_TOOL_DEFINITION,
  STATUTE_VERIFY_TOOL_DEFINITION,
  cebSearch,
  courtlistenerSearch,
  citationVerify,
  statuteVerify,
} from './tools/index.js';
import { getAgentConfig } from './skills.js';

// The verifier uses Sonnet 4.6 — adequate for read-and-decide, faster
// and cheaper than Opus 4.7 for what is fundamentally a structured-
// output task. Override via env if needed.
const VERIFIER_MODEL = process.env.V2_VERIFIER_MODEL ?? 'claude-sonnet-4-6';
const VERIFIER_MAX_TOKENS = 2048;
const VERIFIER_MAX_ROUNDS = 8;

export interface VerifierVerdict {
  /**
   * `real` — tools returned positive evidence (matching CL hit or CEB ref).
   * `fake` — tools returned contradictory evidence (different case at the
   *           cite, or party-name mismatch).
   * `ambiguous` — tools returned NO evidence either way (e.g. CourtListener
   *               rate-limited, CEB had no hit, citation_verify not_found).
   *               Distinguishes "we don't know" from "we know it's fake."
   *               Attorney should verify against Westlaw/Lexis manually.
   */
  status: 'real' | 'fake' | 'ambiguous';
  /** 'case' (court decision) or 'statute' (code section). */
  citation_type?: 'case' | 'statute';
  case_name?: string;
  match_url?: string;
  confidence: number;
  reasoning: string;
  tool_rounds: number;
  elapsed_ms: number;
}

const VERIFIER_SYSTEM_PROMPT = `You are a citation-verification sub-agent. Given a single legal citation in a user message, decide whether the cited authority is REAL, FAKE, or AMBIGUOUS.

STEP 0 — CLASSIFY THE CITATION FIRST:
- A **STATUTE / REGULATION citation** names a code section: e.g. "Penal Code § 187", "Code Civ. Proc. § 437c", "Cal. Civ. Code § 1542", "42 U.S.C. § 1983", "21 C.F.R. § 101.9". No party names, no reporter — just a code/title name and a section number.
- A **CASE citation** names a court decision: e.g. "People v. Anderson (1972) 6 Cal.3d 628". Party names + reporter volume + reporter abbreviation + page + year.

If it is a STATUTE/REGULATION, follow the STATUTE PROTOCOL. Otherwise follow the CASE PROTOCOL.

═══════════════════════════════════════════════════════════
STATUTE PROTOCOL (code sections — CA codes, U.S.C., C.F.R.)
═══════════════════════════════════════════════════════════
1. Call **statute_verify** with the full citation text. It fetches the official source (leginfo for CA, Cornell LII for U.S.C., eCFR.gov for C.F.R.) and returns {outcome, exists, statute_text, source, url}.
2. Map the tool's outcome to your status:
   - outcome="verified" → the section EXISTS. Set status \`real\` UNLESS content-match fails (next step).
   - outcome="not_found" → the section DOES NOT EXIST at the official source. Set status \`fake\` (confidence ≥ 0.9). This is a fabricated/incorrect section number.
   - outcome="unavailable" → the source could not be reached. Set status \`ambiguous\` — you cannot conclude.
   - outcome="unparseable" → statute_verify could not parse a cite; fall back to CASE PROTOCOL or return ambiguous.
3. **CONTENT MATCH (when verified).** If the user's message also asserts what the statute SAYS or stands for, compare that assertion to the returned statute_text. If the statute_text clearly does NOT support the asserted proposition (e.g. the brief says "§ 187 defines burglary" but the text defines murder), set status \`fake\` and explain the mismatch in reasoning — a real section cited for a proposition it doesn't support is still a citation error. If statute_text supports or is consistent with the assertion (or no specific proposition was asserted), keep \`real\`.
4. Put the official section name/heading in case_name and the source URL in match_url. Set citation_type to "statute".

═══════════════════════════════════════════════════════════
CASE PROTOCOL (court decisions)
═══════════════════════════════════════════════════════════

CRITICAL RULES — read carefully:

1. **Ground every conclusion in tool results.** Do NOT rely on your memorized knowledge of cases. Your training data has gaps and errors; the tools are the ground truth. If a tool returns a hit, trust it. If your memory tells you the cite is "actually 69 Cal.2d 59" but the tool returns a different match, GO WITH THE TOOL.

2. **Search BOTH ways.** Always run both:
   - citation_verify on the full citation text (uses CourtListener search-by-citation)
   - courtlistener_search by the CASE-NAME alone (extracts "Name v. Name" from the citation; broader recall)
   Either tool returning a matching case is sufficient evidence.

3. **A match counts when**:
   - The party names in the matched record are essentially the same as the citation's party names (allow for caption variations: "Estate of X" ≈ "In re Estate of X"; "Marriage of X" ≈ "In re Marriage of X"; surname-only matches OK if uncommon).
   - The matched opinion's year (date_filed) is within 3 years of the year in the citation.
   - The matched reporter cite OR the case name's reporter parallel cite roughly corresponds to the citation. CL records sometimes have parallel-reporter cites only.

4. **Pick exactly ONE status:**
   - \`real\` — Positive evidence in at least one tool. A matching CourtListener record OR a CEB practice-guide reference. Confidence ≥ 0.7.
   - \`fake\` — Contradictory evidence. CourtListener returned a hit at the cited reporter but the party names are clearly unrelated, OR returned hits whose dates contradict the cited year, OR the reporter doesn't exist (e.g. "99 Cal.5th" when Cal.5th's max volume is much lower). Confidence ≥ 0.75.
   - \`ambiguous\` — No evidence either way. All tools returned empty (zero hits) OR were unavailable (rate-limited, errored). You CANNOT distinguish a fabricated cite from a genuine old/uncommon opinion missing from CL's index. Confidence 0.3-0.6.

5. **DO NOT collapse ambiguity into fake.** When all tools return empty (no hits AND no contradictory hits), the correct status is \`ambiguous\`, not \`fake\`. The attorney needs to verify against Westlaw/Lexis. Calling these "fake" is a false-positive-fake which costs the attorney trust in the tool.

6. **DO NOT call something fake just because you don't recognize it.** Your memorized knowledge is incomplete.

When done researching, emit your verdict as a JSON object on a single line, preceded by the literal token "VERDICT:" — no leading whitespace, no trailing text after it. Schema:

VERDICT: {"status":"real"|"fake"|"ambiguous","citation_type":"case"|"statute","case_name":"<case name or statute heading as confirmed>","match_url":"<url>","confidence":0.0-1.0,"reasoning":"<one-sentence explanation grounded in what tools returned>"}

Good examples:

VERDICT: {"status":"real","citation_type":"case","case_name":"Navellier v. Sletten","match_url":"https://www.courtlistener.com/opinion/...","confidence":0.98,"reasoning":"citation_verify and courtlistener_search both returned the Cal. Supreme Court 2002 opinion at 29 Cal.4th 82; party names and reporter match exactly."}

VERDICT: {"status":"real","citation_type":"statute","case_name":"Penal Code § 187 — Murder","match_url":"https://leginfo.legislature.ca.gov/...","confidence":0.98,"reasoning":"statute_verify returned outcome=verified; § 187 exists and its text defines murder, consistent with the citation."}

VERDICT: {"status":"fake","citation_type":"statute","confidence":0.93,"reasoning":"statute_verify returned outcome=not_found for Penal Code § 99999; no such section exists at leginfo. Likely a fabricated section number."}

VERDICT: {"status":"fake","citation_type":"statute","case_name":"Penal Code § 187","match_url":"https://leginfo.legislature.ca.gov/...","confidence":0.85,"reasoning":"§ 187 exists but defines murder; the passage cites it for burglary, a content mismatch."}

VERDICT: {"status":"fake","confidence":0.92,"reasoning":"CourtListener returned 'John Doe v. Gary Settle' (unrelated) as the only hit for 'Hendricks v. California Probate Bureau'; courtlistener_search by case-name returned zero hits. No California Supreme Court opinion exists at 7 Cal.5th 904. Likely fabricated."}

VERDICT: {"status":"ambiguous","confidence":0.45,"reasoning":"citation_verify not_found and CourtListener rate-limited; CEB returned no reference. Zero confirmatory and zero contradictory evidence. Older Cal. opinions are often missing from CL's index. Manual verification against Westlaw/Lexis required."}

You may emit at most ONE VERDICT line. Keep reasoning under 280 characters.`;

const VERIFIER_TOOLS = [
  CEB_SEARCH_TOOL_DEFINITION,
  COURTLISTENER_SEARCH_TOOL_DEFINITION,
  CITATION_VERIFY_TOOL_DEFINITION,
  STATUTE_VERIFY_TOOL_DEFINITION,
];

interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

async function dispatchVerifierTool(use: ToolUseBlock): Promise<string> {
  try {
    switch (use.name) {
      case 'citation_verify': {
        const r = await citationVerify(use.input as { text?: string; citations?: string[] });
        return JSON.stringify(r);
      }
      case 'courtlistener_search': {
        const r = await courtlistenerSearch(use.input as { query: string });
        return JSON.stringify(r);
      }
      case 'ceb_search': {
        const r = await cebSearch(use.input as { query: string });
        return JSON.stringify(r);
      }
      case 'statute_verify': {
        const r = await statuteVerify(use.input as { text: string });
        return JSON.stringify(r);
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${use.name}` });
    }
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
  }
}

function extractVerdict(text: string): VerifierVerdict | null {
  const m = text.match(/VERDICT:\s*(\{.*?\})\s*$/m) || text.match(/VERDICT:\s*(\{[^\n]*\})/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(m[1]) as Partial<VerifierVerdict>;
    if (
      parsed.status !== 'real' &&
      parsed.status !== 'fake' &&
      parsed.status !== 'ambiguous'
    ) {
      return null;
    }
    return {
      status: parsed.status,
      citation_type:
        parsed.citation_type === 'statute' || parsed.citation_type === 'case'
          ? parsed.citation_type
          : undefined,
      case_name: parsed.case_name,
      match_url: parsed.match_url,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      reasoning: parsed.reasoning ?? '',
      tool_rounds: 0,
      elapsed_ms: 0,
    };
  } catch {
    return null;
  }
}

/**
 * Verify a single citation via the sub-agent. Stateless — no session
 * persistence, no shared context with the main workbench.
 */
export async function verifyCitationViaSubAgent(citationText: string): Promise<VerifierVerdict> {
  const t0 = performance.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('verifyCitationViaSubAgent: ANTHROPIC_API_KEY not configured');

  const client = new Anthropic({ apiKey });
  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: 'user',
      content: `Verify this citation: ${citationText}`,
    },
  ];

  let toolRounds = 0;
  let finalText = '';
  for (let iter = 0; iter < VERIFIER_MAX_ROUNDS; iter += 1) {
    const response = await client.messages.create({
      model: VERIFIER_MODEL,
      max_tokens: VERIFIER_MAX_TOKENS,
      system: VERIFIER_SYSTEM_PROMPT,
      messages,
      tools: VERIFIER_TOOLS as unknown as Anthropic.Messages.Tool[],
    });

    const blocks = response.content;
    const assistantText: string[] = [];
    const toolUses: ToolUseBlock[] = [];
    for (const b of blocks) {
      if (b.type === 'text') assistantText.push(b.text);
      else if (b.type === 'tool_use') {
        toolUses.push({
          type: 'tool_use',
          id: b.id,
          name: b.name,
          input: b.input as Record<string, unknown>,
        });
      }
    }
    finalText = assistantText.join('\n');

    if (response.stop_reason === 'end_turn' || toolUses.length === 0) {
      break;
    }

    toolRounds += 1;
    messages.push({ role: 'assistant', content: blocks });
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      const content = await dispatchVerifierTool(use);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content,
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  const elapsed = performance.now() - t0;
  const verdict = extractVerdict(finalText);
  if (verdict) {
    verdict.tool_rounds = toolRounds;
    verdict.elapsed_ms = Math.round(elapsed);
    return verdict;
  }

  // Couldn't parse a VERDICT line — we have NO signal about the citation.
  // Return ambiguous (not fake) so the attorney is prompted to verify
  // manually rather than being given a misleading "fake" verdict for what
  // is actually a sub-agent failure.
  return {
    status: 'ambiguous',
    confidence: 0.1,
    reasoning: `Sub-agent did not return a parseable VERDICT. Manual verification required. Raw output: ${finalText.slice(0, 200)}`,
    tool_rounds: toolRounds,
    elapsed_ms: Math.round(elapsed),
  };
}

// Suppress the "imported but unused" warning if the agent config isn't
// referenced — keep it as an explicit dependency for future use.
void getAgentConfig;
