export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    const apiKey = process.env.OPENSTATES_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Server is missing OPENSTATES_API_KEY' });
      return;
    }

    const q = (req.method === 'GET' ? req.query?.q : req.body?.q) || '';
    const query = q.toString().trim();
    if (!query) {
      res.status(400).json({ error: 'Missing q parameter' });
      return;
    }

    // Use OpenStates v3 REST API for broader compatibility
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
      res.status(r.status).json({ error: `OpenStates error: ${r.status} ${r.statusText}`, details: text });
      return;
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
    res.status(200).json({ query, items });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', message: err?.message || String(err) });
  }
}
