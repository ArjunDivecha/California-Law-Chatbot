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

    const graphql = {
      query: `query($q: String!) {
        search(query: $q, first: 5) {
          edges {
            node {
              __typename
              ... on Bill {
                identifier
                title
                classification
                updatedAt
                legislativeSession { identifier jurisdiction { name } }
              }
            }
          }
        }
      }`,
      variables: { q: query },
    };

    const r = await fetch('https://openstates.org/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify(graphql),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => 'Unknown error');
      res.setHeader('Cache-Control', 'no-store');
      res.status(r.status).json({ error: `OpenStates error: ${r.status} ${r.statusText}`, details: text });
      return;
    }

    const data = await r.json();
    const edges = data?.data?.search?.edges || [];
    const items = edges
      .map((e: any) => e?.node)
      .filter((n: any) => n && (n.__typename === 'Bill' || typeof n.identifier === 'string'))
      .map((n: any) => ({
        identifier: n.identifier,
        title: n.title,
        classification: n.classification,
        session: n.legislativeSession?.identifier,
        jurisdiction: n.legislativeSession?.jurisdiction?.name,
        updatedAt: n.updatedAt,
      }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ query, items });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', message: err?.message || String(err) });
  }
}
