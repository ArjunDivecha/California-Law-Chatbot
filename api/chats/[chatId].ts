/**
 * Single-chat CRUD endpoint
 *
 * GET   /api/chats/:chatId        Load chat + messages
 * PUT   /api/chats/:chatId        Save messages (full overwrite)
 * PATCH /api/chats/:chatId        Rename chat
 * DELETE /api/chats/:chatId       Delete chat
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserId, AuthError } from '../../utils/auth.ts';
import { loadChat, saveChat, renameChat, deleteChat } from '../../utils/chatStore.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(200).end();

  const chatId = req.query.chatId as string;
  if (!chatId) return res.status(400).json({ error: 'chatId is required' });

  try {
    const userId = await getUserId(req);

    if (req.method === 'GET') {
      const chat = await loadChat(userId, chatId);
      if (!chat) return res.status(404).json({ error: 'Chat not found' });
      return res.status(200).json(chat);
    }

    if (req.method === 'PUT') {
      const { messages, title } = req.body ?? {};
      if (!Array.isArray(messages)) {
        return res.status(400).json({ error: 'messages array is required' });
      }
      const meta = await saveChat(userId, chatId, messages, title);
      return res.status(200).json(meta);
    }

    if (req.method === 'PATCH') {
      const { title } = req.body ?? {};
      if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'title string is required' });
      }
      const meta = await renameChat(userId, chatId, title.trim().slice(0, 100));
      return res.status(200).json(meta);
    }

    if (req.method === 'DELETE') {
      await deleteChat(userId, chatId);
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    if (err instanceof AuthError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('access denied') || msg.includes('not found')) {
      return res.status(403).json({ error: msg });
    }
    console.error(`[/api/chats/${chatId}]`, err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
