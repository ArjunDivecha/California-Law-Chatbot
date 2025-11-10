export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    const q = (req.query?.q || '').toString().trim();
    if (!q) {
      res.status(400).json({ error: 'Missing q parameter' });
      return;
    }

    // Parse new parameters for exhaustive search
    const limit = parseInt(req.query?.limit as string) || 3;  // Default 3, max 50
    const after = (req.query?.after || '').toString().trim(); // Date filter: after (YYYY-MM-DD)
    const before = (req.query?.before || '').toString().trim(); // Date filter: before (YYYY-MM-DD)
    const page = parseInt(req.query?.page as string) || 1;    // Pagination support
    
    // Cap limit at 50 for performance
    const cappedLimit = Math.min(Math.max(1, limit), 50);

    const apiKey = process.env.COURTLISTENER_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Server is missing COURTLISTENER_API_KEY' });
      return;
    }

    // Build endpoint with date filters and pagination
    let endpoint = `https://www.courtlistener.com/api/rest/v4/search/?q=${encodeURIComponent(q)}&type=o&order_by=dateFiled%20desc&stat_Precedential=on`;
    
    if (after) {
      endpoint += `&filed_after=${after}`;
    }
    if (before) {
      endpoint += `&filed_before=${before}`;
    }
    if (page > 1) {
      endpoint += `&page=${page}`;
    }

    console.log(`🔍 CourtListener search: q="${q.substring(0, 50)}...", limit=${cappedLimit}, after=${after || 'none'}, before=${before || 'none'}, page=${page}`);

    const clRes = await fetch(endpoint, {
      headers: {
        Authorization: `Token ${apiKey}`,
        'User-Agent': 'California Law Chatbot/1.0',
      },
    });

    if (!clRes.ok) {
      const text = await clRes.text().catch(() => 'Unknown error');
      res.status(clRes.status).json({ error: `CourtListener error: ${clRes.status} ${clRes.statusText}`, details: text });
      return;
    }

    const data = await clRes.json();
    const results = Array.isArray(data.results) ? data.results : [];
    const topResults = results.slice(0, cappedLimit);

    const content = topResults
      .map((r: any, i: number) => `Result ${i + 1}:\nCase Name: ${r.caseName}\nCitation: ${r.citation}\nDate Filed: ${r.dateFiled}\nSnippet: ${r.snippet}`)
      .join('\n\n');

    const sources = topResults.map((r: any) => ({
      title: r.caseName || 'Untitled Case',
      url: `https://www.courtlistener.com${r.absolute_url}`,
    }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ content, sources });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', message: err?.message || String(err) });
  }
}

