import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildPublicLegalContext } from './_shared/publicLegalContext.js';
import { rejectWithBackstop, scanForRawPII } from './_shared/sanitization/guard.js';
import { buildAuditRecord, writeAuditRecord } from './_shared/auditLog.js';

export const config = {
  maxDuration: 20,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const rawQuery = req.method === 'GET'
    ? req.query?.q
    : req.body?.query || req.body?.q || req.body?.message;
  const query = Array.isArray(rawQuery) ? rawQuery[0] : String(rawQuery || '').trim();

  if (!query) {
    res.status(400).json({ error: 'Missing query parameter' });
    return;
  }

  const backstop = scanForRawPII(query);
  if (rejectWithBackstop(res, backstop)) {
    writeAuditRecord(
      buildAuditRecord({
        route: 'public-legal-context',
        sanitizedPrompt: query,
        backstopTriggered: true,
        backstopCategories: 'categories' in backstop ? backstop.categories : undefined,
        statusCode: 400,
      })
    );
    return;
  }
  const _auditStart = Date.now();

  try {
    const result = await buildPublicLegalContext(query);
    res.status(200).json(result);
    writeAuditRecord(
      buildAuditRecord({
        route: 'public-legal-context',
        sanitizedPrompt: query,
        sourceProviders: ['public-legal'],
        latencyMs: Date.now() - _auditStart,
        statusCode: 200,
      })
    );
  } catch (error: any) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error?.message || String(error),
    });
  }
}
