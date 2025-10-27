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

    const apiKey = process.env.COURTLISTENER_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Server is missing COURTLISTENER_API_KEY' });
      return;
    }

    const endpoint = `https://www.courtlistener.com/api/rest/v4/search/?q=${encodeURIComponent(q)}&type=o&order_by=score%20desc&stat_Precedential=on`;
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
    const topResults = results.slice(0, 3);

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

