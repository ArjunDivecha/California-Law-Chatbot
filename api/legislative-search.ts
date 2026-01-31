/**
 * Legislative Search API Endpoint
 * 
 * GET /api/legislative-search?q=query&source=openstates|legiscan
 * 
 * Unified endpoint for searching California legislation via OpenStates or LegiScan
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 20,
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const q = (req.method === 'GET' ? req.query?.q : req.body?.q) || '';
    const source = ((req.method === 'GET' ? req.query?.source : req.body?.source) || 'openstates').toString().toLowerCase();
    const query = q.toString().trim();

    if (!query) {
      return res.status(400).json({ error: 'Missing q parameter' });
    }

    if (source === 'legiscan') {
      // LegiScan search
      const apiKey = process.env.LEGISCAN_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Server is missing LEGISCAN_API_KEY' });
      }

      const url = `https://api.legiscan.com/?key=${encodeURIComponent(apiKey)}&op=search&state=CA&query=${encodeURIComponent(query)}`;
      const r = await fetch(url);
      
      if (!r.ok) {
        const text = await r.text().catch(() => 'Unknown error');
        return res.status(r.status).json({ error: `LegiScan error: ${r.status} ${r.statusText}`, details: text });
      }

      const data = await r.json();
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
      return res.status(200).json(data);
    } else {
      // OpenStates search (default)
      const apiKey = process.env.OPENSTATES_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Server is missing OPENSTATES_API_KEY' });
      }

      const url = new URL('https://v3.openstates.org/bills');
      url.searchParams.set('per_page', '5');
      url.searchParams.set('jurisdiction', 'California');
      url.searchParams.set('query', query);

      const r = await fetch(url.toString(), {
        headers: { 'X-API-KEY': apiKey },
      });

      if (!r.ok) {
        const text = await r.text().catch(() => 'Unknown error');
        res.setHeader('Cache-Control', 'no-store');
        return res.status(r.status).json({ error: `OpenStates error: ${r.status} ${r.statusText}`, details: text });
      }

      const data = await r.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      const items = results.map((b: any) => ({
        identifier: b?.identifier,
        title: b?.title,
        classification: b?.classification,
        session: b?.from_organization || b?.legislative_session || b?.session,
        jurisdiction: b?.jurisdiction?.name || 'California',
        updatedAt: b?.updated_at || b?.updatedAt,
        url: b?.openstates_url || b?.sources?.[0]?.url,
      }));

      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
      return res.status(200).json({ query, items });
    }
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: err?.message || String(err) });
  }
}
