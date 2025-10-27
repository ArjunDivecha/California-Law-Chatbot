export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    const apiKey = process.env.LEGISCAN_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Server is missing LEGISCAN_API_KEY' });
      return;
    }

    const q = (req.query?.q || '').toString().trim();
    if (!q) {
      res.status(400).json({ error: 'Missing q parameter' });
      return;
    }

    const url = `https://api.legiscan.com/?key=${encodeURIComponent(apiKey)}&op=search&state=CA&query=${encodeURIComponent(q)}`;
    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text().catch(() => 'Unknown error');
      res.status(r.status).json({ error: `LegiScan error: ${r.status} ${r.statusText}`, details: text });
      return;
    }

    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', message: err?.message || String(err) });
  }
}

