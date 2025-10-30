/**
 * OpenStates Bill Text Fetcher
 * 
 * Fetches the full text of a specific California bill using OpenStates API.
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

    const apiKey = process.env.OPENSTATES_API_KEY;
    if (!apiKey) {
      console.error('OPENSTATES_API_KEY is not set in environment variables');
      res.status(500).json({ 
        error: 'Server configuration error',
        message: 'OPENSTATES_API_KEY environment variable is not configured'
      });
      return;
    }

    const billId = req.query.billId?.toString().trim();
    if (!billId) {
      res.status(400).json({ error: 'Missing billId parameter' });
      return;
    }

    console.log(`Fetching bill text for: ${billId}`);

    // OpenStates v3 API: Get bill details including versions
    const billUrl = `https://v3.openstates.org/bills/${encodeURIComponent(billId)}`;
    const billResponse = await fetch(billUrl, {
      headers: { 'X-API-KEY': apiKey },
    });

    if (!billResponse.ok) {
      const text = await billResponse.text().catch(() => 'Unknown error');
      console.error(`OpenStates bill fetch error: ${billResponse.status}`, text);
      res.status(billResponse.status).json({ 
        error: `OpenStates error: ${billResponse.status} ${billResponse.statusText}`, 
        details: text 
      });
      return;
    }

    const billData = await billResponse.json();
    
    // Get the latest version of the bill text
    const versions = billData?.versions || [];
    if (versions.length === 0) {
      console.log('No bill text versions available');
      res.status(404).json({ 
        error: 'No bill text available',
        message: 'This bill does not have any text versions available yet'
      });
      return;
    }

    // Get the most recent version (last in array is typically most recent)
    const latestVersion = versions[versions.length - 1];
    const versionNote = latestVersion?.note || 'Latest version';
    
    // OpenStates provides bill text in multiple formats
    // Try to get the text from media_type links
    const links = latestVersion?.links || [];
    let billText = '';
    
    // Prefer text/html or text/plain formats
    const textLink = links.find((link: any) => 
      link.media_type === 'text/html' || 
      link.media_type === 'text/plain'
    );

    if (textLink) {
      console.log(`Fetching bill text from: ${textLink.url}`);
      const textResponse = await fetch(textLink.url);
      if (textResponse.ok) {
        billText = await textResponse.text();
        
        // If HTML, strip tags for cleaner text
        if (textLink.media_type === 'text/html') {
          // Basic HTML stripping (remove script, style, and tags)
          billText = billText
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }
      }
    }

    // Fallback: use the title and summary if no text available
    if (!billText && billData?.title) {
      billText = `${billData.title}\n\n${billData?.abstracts?.[0]?.abstract || 'Full text not yet available.'}`;
    }

    // Limit text length to avoid overwhelming responses (max 50KB)
    const maxLength = 50000;
    if (billText.length > maxLength) {
      console.log(`Truncating bill text from ${billText.length} to ${maxLength} characters`);
      billText = billText.substring(0, maxLength) + '\n\n[Text truncated due to length...]';
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
    res.status(200).json({
      billId: billData.id,
      identifier: billData.identifier,
      title: billData.title,
      session: billData.legislative_session?.identifier,
      versionNote,
      text: billText,
      textLength: billText.length,
      url: billData.openstates_url
    });

  } catch (err: any) {
    console.error('OpenStates Bill Text API error:', err);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: err?.message || String(err),
      details: process.env.NODE_ENV === 'development' ? err?.stack : undefined
    });
  }
}

