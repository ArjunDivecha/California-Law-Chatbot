/**
 * Legislative Fan-out Endpoint
 *
 * POST /api/legislative-fanout
 *   body: { question: string }
 *
 * Runs a full recall pass over OpenStates + LegiScan:
 *   1. Ask Claude Haiku for 3–8 search variants of the question
 *      (plus the raw question as a safety net).
 *   2. Fan out every variant against both providers in parallel.
 *   3. Merge and dedupe by bill number, preserving first source URL seen.
 *
 * Used by the chat path to give the legislative generator a much wider
 * retrieval base than a single literal-keyword query against OpenStates.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { planLegislativeQueries } from './_shared/researchPlanner.js';

export const config = {
  maxDuration: 30,
};

interface MergedBill {
  billNumber: string;
  title: string;
  session?: string;
  jurisdiction?: string;
  lastAction?: string;
  updatedAt?: string;
  url?: string;
  providers: Array<'openstates' | 'legiscan'>;
  matchedVariants: string[];
}

function normalizeBillNumber(raw: string | undefined): string | null {
  if (!raw) return null;
  const stripped = raw.replace(/[\s.]/g, '').toUpperCase();
  if (!/^[A-Z]+\d+$/.test(stripped)) return null;
  return stripped;
}

async function runOpenStates(query: string, apiKey: string): Promise<any[]> {
  const url = new URL('https://v3.openstates.org/bills');
  url.searchParams.set('per_page', '10');
  url.searchParams.set('jurisdiction', 'California');
  url.searchParams.set('query', query);
  const r = await fetch(url.toString(), { headers: { 'X-API-KEY': apiKey } });
  if (!r.ok) return [];
  const data: any = await r.json().catch(() => null);
  return Array.isArray(data?.results) ? data.results : [];
}

async function runLegiScan(query: string, apiKey: string): Promise<any[]> {
  const url = `https://api.legiscan.com/?key=${encodeURIComponent(apiKey)}&op=search&state=CA&query=${encodeURIComponent(query)}`;
  const r = await fetch(url);
  if (!r.ok) return [];
  const data: any = await r.json().catch(() => null);
  const sr = data?.searchresult;
  if (!sr || typeof sr !== 'object') return [];
  return Object.values(sr).filter(
    (entry: any) => entry && typeof entry === 'object' && entry.bill_number
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const question = String(req.body?.question || '').trim();
  if (!question) {
    res.status(400).json({ error: 'Missing question' });
    return;
  }

  const openStatesKey = process.env.OPENSTATES_API_KEY;
  const legiScanKey = process.env.LEGISCAN_API_KEY;

  // Build the variant set: LLM plan + raw question as a guaranteed fallback.
  const plan = await planLegislativeQueries(question);
  const variants = Array.from(new Set([question, ...plan.variants])).slice(0, 8);

  // Fan out in parallel.
  const tasks: Array<Promise<{ provider: 'openstates' | 'legiscan'; variant: string; results: any[] }>> = [];
  for (const v of variants) {
    if (openStatesKey) {
      tasks.push(
        runOpenStates(v, openStatesKey)
          .then((results) => ({ provider: 'openstates' as const, variant: v, results }))
          .catch(() => ({ provider: 'openstates' as const, variant: v, results: [] }))
      );
    }
    if (legiScanKey) {
      tasks.push(
        runLegiScan(v, legiScanKey)
          .then((results) => ({ provider: 'legiscan' as const, variant: v, results }))
          .catch(() => ({ provider: 'legiscan' as const, variant: v, results: [] }))
      );
    }
  }

  const settled = await Promise.all(tasks);

  // Merge by normalized bill number.
  const merged = new Map<string, MergedBill>();
  for (const { provider, variant, results } of settled) {
    for (const r of results) {
      const rawNum =
        provider === 'openstates'
          ? String(r?.identifier || '')
          : String(r?.bill_number || '');
      const billNumber = normalizeBillNumber(rawNum);
      if (!billNumber) continue;

      const title = String(r?.title || '').trim();
      const url =
        provider === 'openstates'
          ? r?.openstates_url || r?.sources?.[0]?.url
          : r?.url || r?.state_link;
      const lastAction =
        provider === 'openstates'
          ? r?.latest_action_description
          : r?.last_action;
      const updatedAt = provider === 'openstates' ? r?.updated_at : r?.last_action_date;
      const session =
        provider === 'openstates'
          ? r?.legislative_session || r?.session
          : r?.session;
      const jurisdiction = r?.jurisdiction?.name || 'California';

      const existing = merged.get(billNumber);
      if (existing) {
        if (!existing.providers.includes(provider)) existing.providers.push(provider);
        if (!existing.matchedVariants.includes(variant)) existing.matchedVariants.push(variant);
        if (!existing.url && url) existing.url = String(url);
        if (!existing.title && title) existing.title = title;
        if (!existing.lastAction && lastAction) existing.lastAction = String(lastAction);
      } else {
        merged.set(billNumber, {
          billNumber,
          title,
          session: session ? String(session) : undefined,
          jurisdiction: jurisdiction ? String(jurisdiction) : undefined,
          lastAction: lastAction ? String(lastAction) : undefined,
          updatedAt: updatedAt ? String(updatedAt) : undefined,
          url: url ? String(url) : undefined,
          providers: [provider],
          matchedVariants: [variant],
        });
      }
    }
  }

  const bills = Array.from(merged.values())
    // Rank: more matched variants first, then bills with a URL, then by recency.
    .sort((a, b) => {
      if (b.matchedVariants.length !== a.matchedVariants.length)
        return b.matchedVariants.length - a.matchedVariants.length;
      if (!!b.url !== !!a.url) return b.url ? 1 : -1;
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    })
    .slice(0, 20);

  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=600');
  res.status(200).json({
    question,
    variants,
    rationale: plan.rationale,
    bills,
  });
}
