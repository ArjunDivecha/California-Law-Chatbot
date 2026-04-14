/**
 * Chat list + create endpoint
 *
 * GET  /api/chats        List authenticated user's chats (newest first)
 * POST /api/chats        Create a new empty chat
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserId, AuthError } from '../../utils/auth.ts';
import { createChat, listChats } from '../../utils/chatStore.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const userId = await getUserId(req);

    if (req.method === 'GET') {
      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const offset = Number(req.query.offset) || 0;
      const chats = await listChats(userId, { limit, offset });
      return res.status(200).json({ chats });
    }

    if (req.method === 'POST') {
      const { title } = req.body ?? {};
      const meta = await createChat(userId, title);
      return res.status(201).json(meta);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error('[/api/chats]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
