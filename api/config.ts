export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    // Return configuration that's safe to expose to client
    res.status(200).json({
      hasCourtListenerKey: !!process.env.COURTLISTENER_API_KEY,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error', message: err?.message || String(err) });
  }
}
