/**
 * Legislative Bill Text API Endpoint
 * 
 * GET /api/legislative-billtext?billId=xxx&source=openstates|legiscan
 * 
 * Unified endpoint for fetching California bill text via OpenStates or LegiScan
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 30,
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const billId = req.query.billId?.toString().trim();
    const source = (req.query.source?.toString().toLowerCase() || 'openstates');

    if (!billId) {
      return res.status(400).json({ error: 'Missing billId parameter' });
    }

    if (source === 'legiscan') {
      // LegiScan bill text
      const apiKey = process.env.LEGISCAN_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ 
          error: 'Server configuration error',
          message: 'LEGISCAN_API_KEY environment variable is not configured'
        });
      }

      console.log(`Fetching LegiScan bill text for bill ID: ${billId}`);

      const billUrl = `https://api.legiscan.com/?key=${encodeURIComponent(apiKey)}&op=getBill&id=${encodeURIComponent(billId)}`;
      const billResponse = await fetch(billUrl);

      if (!billResponse.ok) {
        const text = await billResponse.text().catch(() => 'Unknown error');
        return res.status(billResponse.status).json({ 
          error: `LegiScan error: ${billResponse.status} ${billResponse.statusText}`, 
          details: text 
        });
      }

      const data = await billResponse.json();
      const bill = data?.bill;

      if (!bill) {
        return res.status(404).json({ error: 'Bill not found', message: 'LegiScan could not find this bill' });
      }

      const texts = bill?.texts || [];
      if (texts.length === 0) {
        return res.status(404).json({ error: 'No bill text available', message: 'This bill does not have any text versions available yet' });
      }

      const latestText = texts[texts.length - 1];
      const docId = latestText?.doc_id;

      if (!docId) {
        return res.status(404).json({ error: 'No document ID available', message: 'Cannot retrieve bill text without document ID' });
      }

      const textUrl = `https://api.legiscan.com/?key=${encodeURIComponent(apiKey)}&op=getBillText&id=${encodeURIComponent(docId)}`;
      const textResponse = await fetch(textUrl);

      if (!textResponse.ok) {
        const text = await textResponse.text().catch(() => 'Unknown error');
        return res.status(textResponse.status).json({ 
          error: `LegiScan text error: ${textResponse.status} ${textResponse.statusText}`, 
          details: text 
        });
      }

      const textData = await textResponse.json();
      const textDoc = textData?.text;

      if (!textDoc) {
        return res.status(404).json({ error: 'No text document available', message: 'LegiScan returned no text document' });
      }

      let billText = '';
      if (textDoc.doc) {
        try {
          billText = Buffer.from(textDoc.doc, 'base64').toString('utf-8');
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

      if (!billText && bill.description) {
        billText = bill.description;
      }

      const maxLength = 50000;
      if (billText.length > maxLength) {
        billText = billText.substring(0, maxLength) + '\n\n[Text truncated due to length...]';
      }

      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json({
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
    } else {
      // OpenStates bill text (default)
      const apiKey = process.env.OPENSTATES_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ 
          error: 'Server configuration error',
          message: 'OPENSTATES_API_KEY environment variable is not configured'
        });
      }

      console.log(`Fetching bill text for: ${billId}`);

      const billUrl = `https://v3.openstates.org/bills/${encodeURIComponent(billId)}`;
      const billResponse = await fetch(billUrl, {
        headers: { 'X-API-KEY': apiKey },
      });

      if (!billResponse.ok) {
        const text = await billResponse.text().catch(() => 'Unknown error');
        return res.status(billResponse.status).json({ 
          error: `OpenStates error: ${billResponse.status} ${billResponse.statusText}`, 
          details: text 
        });
      }

      const billData = await billResponse.json();
      const versions = billData?.versions || [];
      
      if (versions.length === 0) {
        return res.status(404).json({ 
          error: 'No bill text available',
          message: 'This bill does not have any text versions available yet'
        });
      }

      const latestVersion = versions[versions.length - 1];
      const versionNote = latestVersion?.note || 'Latest version';
      const links = latestVersion?.links || [];
      let billText = '';
      
      const textLink = links.find((link: any) => 
        link.media_type === 'text/html' || 
        link.media_type === 'text/plain'
      );

      if (textLink) {
        const textResponse = await fetch(textLink.url);
        if (textResponse.ok) {
          billText = await textResponse.text();
          if (textLink.media_type === 'text/html') {
            billText = billText
              .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
          }
        }
      }

      if (!billText && billData?.title) {
        billText = `${billData.title}\n\n${billData?.abstracts?.[0]?.abstract || 'Full text not yet available.'}`;
      }

      const maxLength = 50000;
      if (billText.length > maxLength) {
        billText = billText.substring(0, maxLength) + '\n\n[Text truncated due to length...]';
      }

      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');
      return res.status(200).json({
        billId: billData.id,
        identifier: billData.identifier,
        title: billData.title,
        session: billData.legislative_session?.identifier,
        versionNote,
        text: billText,
        textLength: billText.length,
        url: billData.openstates_url
      });
    }
  } catch (err: any) {
    console.error('Legislative Bill Text API error:', err);
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      message: err?.message || String(err),
      details: process.env.NODE_ENV === 'development' ? err?.stack : undefined
    });
  }
}
