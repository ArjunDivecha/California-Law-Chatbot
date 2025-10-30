/**
 * LegiScan Bill Text Fetcher
 * 
 * Fetches the full text of a specific California bill using LegiScan API.
 * Returns the latest version of the bill text.
 */

export default async function handler(req: any, res: any) {
  // Enable CORS
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

    const apiKey = process.env.LEGISCAN_API_KEY;
    if (!apiKey) {
      console.error('LEGISCAN_API_KEY is not set in environment variables');
      res.status(500).json({ 
        error: 'Server configuration error',
        message: 'LEGISCAN_API_KEY environment variable is not configured'
      });
      return;
    }

    const billId = req.query.billId?.toString().trim();
    if (!billId) {
      res.status(400).json({ error: 'Missing billId parameter' });
      return;
    }

    console.log(`Fetching LegiScan bill text for bill ID: ${billId}`);

    // LegiScan API: Get bill details including text
    const billUrl = `https://api.legiscan.com/?key=${encodeURIComponent(apiKey)}&op=getBill&id=${encodeURIComponent(billId)}`;
    const billResponse = await fetch(billUrl);

    if (!billResponse.ok) {
      const text = await billResponse.text().catch(() => 'Unknown error');
      console.error(`LegiScan bill fetch error: ${billResponse.status}`, text);
      res.status(billResponse.status).json({ 
        error: `LegiScan error: ${billResponse.status} ${billResponse.statusText}`, 
        details: text 
      });
      return;
    }

    const data = await billResponse.json();
    const bill = data?.bill;

    if (!bill) {
      res.status(404).json({ 
        error: 'Bill not found',
        message: 'LegiScan could not find this bill'
      });
      return;
    }

    // Get the latest text version
    const texts = bill?.texts || [];
    if (texts.length === 0) {
      console.log('No bill text versions available');
      res.status(404).json({ 
        error: 'No bill text available',
        message: 'This bill does not have any text versions available yet'
      });
      return;
    }

    // Get the most recent text version (last in array)
    const latestText = texts[texts.length - 1];
    const docId = latestText?.doc_id;

    if (!docId) {
      res.status(404).json({ 
        error: 'No document ID available',
        message: 'Cannot retrieve bill text without document ID'
      });
      return;
    }

    // Fetch the actual bill text document
    console.log(`Fetching bill text document ID: ${docId}`);
    const textUrl = `https://api.legiscan.com/?key=${encodeURIComponent(apiKey)}&op=getBillText&id=${encodeURIComponent(docId)}`;
    const textResponse = await fetch(textUrl);

    if (!textResponse.ok) {
      const text = await textResponse.text().catch(() => 'Unknown error');
      console.error(`LegiScan text fetch error: ${textResponse.status}`, text);
      res.status(textResponse.status).json({ 
        error: `LegiScan text error: ${textResponse.status} ${textResponse.statusText}`, 
        details: text 
      });
      return;
    }

    const textData = await textResponse.json();
    const textDoc = textData?.text;

    if (!textDoc) {
      res.status(404).json({ 
        error: 'No text document available',
        message: 'LegiScan returned no text document'
      });
      return;
    }

    // LegiScan returns base64-encoded text
    let billText = '';
    if (textDoc.doc) {
      try {
        billText = Buffer.from(textDoc.doc, 'base64').toString('utf-8');
        
        // If HTML, strip tags for cleaner text
        if (textDoc.mime === 'text/html' || billText.includes('<html')) {
          billText = billText
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
      } catch (err) {
        console.error('Error decoding base64 bill text:', err);
        billText = 'Error decoding bill text';
      }
    }

    // Fallback to description if no text
    if (!billText && bill.description) {
      billText = bill.description;
    }

    // Limit text length to avoid overwhelming responses (max 50KB)
    const maxLength = 50000;
    if (billText.length > maxLength) {
      console.log(`Truncating bill text from ${billText.length} to ${maxLength} characters`);
      billText = billText.substring(0, maxLength) + '\n\n[Text truncated due to length...]';
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    res.status(200).json({
      billId: bill.bill_id,
      billNumber: bill.bill_number,
      title: bill.title,
      description: bill.description,
      session: bill.session?.session_name,
      statusDate: bill.status_date,
      textDate: textDoc.date,
      text: billText,
      textLength: billText.length,
      url: bill.url
    });

  } catch (err: any) {
    console.error('LegiScan Bill Text API error:', err);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: err?.message || String(err),
      details: process.env.NODE_ENV === 'development' ? err?.stack : undefined
    });
  }
}

