/**
 * Serper Google Scholar Search API Endpoint
 * 
 * Searches Google Scholar for California case law
 * Filters to prioritize actual cases over academic articles
 */

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    const q = (req.query?.q || '').toString().trim();
    const limit = Math.min(parseInt(req.query?.limit as string) || 10, 20);
    const californiaOnly = (req.query?.californiaOnly || '').toString().toLowerCase() === 'true';

    if (!q) {
      res.status(400).json({ error: 'Missing q parameter' });
      return;
    }

    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Server is missing SERPER_API_KEY' });
      return;
    }

    console.log(`🎓 Google Scholar: "${q.substring(0, 50)}...", limit=${limit}, californiaOnly=${californiaOnly}`);

    const response = await fetch('https://google.serper.dev/scholar', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q, gl: 'us', hl: 'en', num: limit })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error');
      res.status(response.status).json({ error: `Serper error: ${response.status}`, details: text });
      return;
    }

    const data = await response.json();
    const results = Array.isArray(data.organic) ? data.organic : [];

    // Score results to prioritize case law over scholarship
    const scoredResults = results.map((r: any) => {
      let score = 0;
      const title = (r.title || '').toLowerCase();
      const snippet = (r.snippet || '').toLowerCase();
      const link = (r.link || '').toLowerCase();
      
      // BOOST: Case law indicators
      if (title.includes(' v. ') || title.includes(' v ')) score += 20;
      if (title.match(/\d+\s+(cal|p\.\d+d|u\.s\.|f\.\d+d)/)) score += 15;
      if (link.includes('courtlistener.com')) score += 25;
      if (link.includes('courts.ca.gov')) score += 25;
      if (link.includes('findlaw.com/cases')) score += 20;
      if (link.includes('justia.com/cases')) score += 20;
      if (link.includes('leagle.com')) score += 20;
      if (link.includes('casetext.com')) score += 20;
      if (snippet.includes('court held') || snippet.includes('court found')) score += 10;
      if (snippet.includes('plaintiff') || snippet.includes('defendant')) score += 10;
      
      
      // BOOST: California-specific indicators (when californiaOnly filter is active)
      if (californiaOnly) {
        if (title.includes('california') || snippet.includes('california')) score += 15;
        if (link.includes('courts.ca.gov')) score += 20;
        if (title.match(/cal\.?(\s|\d)/i) || snippet.match(/cal\.?(\s|\d)/i)) score += 10;
        if (title.includes('cal. app.') || snippet.includes('cal. app.')) score += 15;
      }
      
      // PENALIZE: Scholarship indicators
      if (link.includes('heinonline.org')) score -= 10;
      if (link.includes('jstor.org')) score -= 10;
      if (link.includes('ssrn.com')) score -= 15;
      if (link.includes('arxiv.org')) score -= 15;
      if (title.includes('journal') || title.includes('review')) score -= 5;
      
      // BOOST: California-specific
      if (title.includes('california') || snippet.includes('california')) score += 5;
      
      return { ...r, caseScore: score };
    });

    const sortedResults = scoredResults.sort((a: any, b: any) => b.caseScore - a.caseScore);
    const topResults = sortedResults.slice(0, limit);
    
    const sources = topResults.map((r: any) => ({
      title: r.title || 'Untitled',
      url: r.link || '',
      excerpt: r.snippet || ''
    }));

    const content = topResults.map((r: any, i: number) => 
      `Result ${i + 1}:\nCase Name: ${r.title}\nCitation: ${r.snippet}\nLink: ${r.link}`
    ).join('\n\n');

    console.log(`✅ Scholar: Found ${sources.length} results (${topResults.filter((r: any) => r.caseScore > 0).length} likely cases)`);

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    res.status(200).json({ content, sources });

  } catch (err: any) {
    console.error('Serper Scholar API error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err?.message || String(err) });
  }
}
