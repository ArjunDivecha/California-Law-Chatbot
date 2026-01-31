/**
 * CourtListener Search API Endpoint (v4)
 *
 * Docs: https://www.courtlistener.com/help/api/rest/search
 *
 * Key points from the docs:
 * - Keyword search uses GET and the same query params as the website frontend.
 * - Court filters are passed as `court_<abbreviation>=on` query params (see jurisdictions list).
 *
 * This endpoint proxies CourtListener and returns BOTH:
 * - `content` + `sources` for the main chat UI (existing behavior)
 * - `results` (simplified) for internal agents/orchestrators that need structured fields
 */
export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const q = (req.query?.q || '').toString().trim();
    if (!q) {
      return res.status(400).json({ error: 'Missing q parameter' });
    }

    const limitRaw = parseInt(req.query?.limit as string);
    const limit = Number.isFinite(limitRaw) ? limitRaw : 3; // Default 3, max 50

    const after = (req.query?.after || '').toString().trim(); // YYYY-MM-DD
    const before = (req.query?.before || '').toString().trim(); // YYYY-MM-DD
    const pageRaw = parseInt(req.query?.page as string);
    const page = Number.isFinite(pageRaw) ? pageRaw : 1;
    const cursor = (req.query?.cursor || '').toString().trim();

    const californiaOnly = (req.query?.californiaOnly || '').toString().toLowerCase() === 'true';
    const cappedLimit = Math.min(Math.max(1, limit), 50);

    const apiKey = process.env.COURTLISTENER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server is missing COURTLISTENER_API_KEY' });
    }

    const url = new URL('https://www.courtlistener.com/api/rest/v4/search/');

    // Court filtering is done via advanced query operators in the `q` parameter.
    // (CourtListener search docs + operators docs: use `court_id:<abbrev>`.)
    const queryWithCourt = californiaOnly
      ? `(${q}) AND (court_id:cal OR court_id:calctapp OR court_id:calappdeptsuper OR court_id:ca9 OR court_id:cacd OR court_id:caed OR court_id:cand OR court_id:casd)`
      : q;

    url.searchParams.set('q', queryWithCourt);
    url.searchParams.set('type', 'o'); // case law opinions (clusters)

    if (after) url.searchParams.set('filed_after', after);
    if (before) url.searchParams.set('filed_before', before);
    if (cursor) url.searchParams.set('cursor', cursor);
    if (!cursor && page > 1) url.searchParams.set('page', String(page));

    console.log(
      `🔍 CourtListener search: q="${q.substring(0, 50)}...", limit=${cappedLimit}, californiaOnly=${californiaOnly}, after=${after || 'none'}, before=${before || 'none'}, page=${page}, cursor=${cursor ? 'present' : 'none'}`
    );

    const headers = {
      Authorization: `Token ${apiKey}`,
      'User-Agent': 'California Law Chatbot/1.0',
      Accept: 'application/json',
    };

    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    const maxAttempts = 3; // 1 initial + 2 retries
    const timeoutMs = 20000; // Keep under typical serverless limits
    let lastErr: unknown = null;
    let clRes: Response | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        clRes = await fetch(url.toString(), { headers, signal: controller.signal });
        clearTimeout(timeoutId);

        if (clRes.ok) break;

        // Retry on 5xx (CourtListener overload/maintenance) but fail fast on 4xx
        if (clRes.status >= 500 && attempt < maxAttempts) {
          const delay = 750 * Math.pow(2, attempt - 1);
          console.log(`⚠️ CourtListener ${clRes.status} – retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
          await sleep(delay);
          continue;
        }

        break;
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastErr = err;

        if (err?.name === 'AbortError') {
          if (attempt < maxAttempts) {
            const delay = 750 * Math.pow(2, attempt - 1);
            console.log(`⚠️ CourtListener timeout after ${timeoutMs}ms – retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
            await sleep(delay);
            continue;
          }

          return res.status(504).json({
            error: 'CourtListener request timed out',
            timeoutMs,
          });
        }

        if (attempt < maxAttempts) {
          const delay = 750 * Math.pow(2, attempt - 1);
          console.log(`⚠️ CourtListener fetch failed (${String(err?.message || err)}) – retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
          await sleep(delay);
          continue;
        }

        return res.status(502).json({
          error: 'CourtListener request failed',
          message: String(err?.message || err),
        });
      }
    }

    if (!clRes) {
      return res.status(502).json({
        error: 'CourtListener request failed',
        message: lastErr instanceof Error ? lastErr.message : String(lastErr),
      });
    }

    if (!clRes.ok) {
      const text = await clRes.text().catch(() => '');
      return res.status(clRes.status).json({
        error: `CourtListener error: ${clRes.status} ${clRes.statusText}`,
        details: text ? text.slice(0, 2000) : undefined,
      });
    }

    const data = await clRes.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    const topResults = results.slice(0, cappedLimit);

    const simplifiedResults = topResults.map((r: any) => {
      const citation = Array.isArray(r?.citation)
        ? r.citation.filter(Boolean).join('; ')
        : (typeof r?.citation === 'string' ? r.citation : '');

      const snippet = r?.snippet || r?.opinions?.[0]?.snippet || '';

      return {
        caseName: r?.caseName || r?.case_name || 'Unknown Case',
        citation,
        court: r?.court || '',
        dateFiled: r?.dateFiled || '',
        clusterId: r?.cluster_id || r?.clusterId || '',
        absolute_url: r?.absolute_url || '',
        url: r?.absolute_url ? `https://www.courtlistener.com${r.absolute_url}` : '',
        snippet,
      };
    });

    const content = simplifiedResults
      .map((r: any, i: number) => {
        const year = r.dateFiled ? ` (${String(r.dateFiled).slice(0, 4)})` : '';
        return `Result ${i + 1}:\nCase Name: ${r.caseName}${year}\nCitation: ${r.citation}\nCourt: ${r.court}\nDate Filed: ${r.dateFiled}\nSnippet: ${r.snippet || 'No snippet available'}`;
      })
      .join('\n\n');

    const sources = simplifiedResults
      .filter((r: any) => r.url)
      .map((r: any) => ({
        title: r.caseName || 'Untitled Case',
        url: r.url,
      }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      content,
      sources,
      results: simplifiedResults,
      // Include cursor pagination info if present (useful for debugging)
      next: data?.next,
      count: data?.count,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal Server Error', message: err?.message || String(err) });
  }
}

