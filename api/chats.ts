/**
 * Chat history CRUD endpoint (single flat file — avoids nested-dir bundling issues on Vercel).
 *
 * GET    /api/chats          List user's chats (newest first)
 * POST   /api/chats          Create new chat
 * GET    /api/chats?id=xxx   Load chat + messages
 * PUT    /api/chats?id=xxx   Save messages (full overwrite)
 * PATCH  /api/chats?id=xxx   Rename chat
 * DELETE /api/chats?id=xxx   Delete chat
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyToken } from '@clerk/backend';
import { Redis } from '@upstash/redis';
import { put, del, head } from '@vercel/blob';
import { randomUUID } from 'crypto';
import type { ChatMessage } from '../types';

// ─── CORS ───────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ─── AUTH ────────────────────────────────────────────────────────────────────

async function getUserId(req: VercelRequest): Promise<string> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw Object.assign(new Error('CLERK_SECRET_KEY not set'), { status: 500 });

  let token: string | undefined;
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    token = auth.slice(7);
  } else {
    const cookie = req.headers.cookie ?? '';
    const m = cookie.match(/(?:^|;\s*)__session=([^;]+)/);
    token = m ? decodeURIComponent(m[1]) : undefined;
  }

  if (!token) throw Object.assign(new Error('No session token'), { status: 401 });

  try {
    const payload = await verifyToken(token, { secretKey });
    if (!payload.sub) throw new Error('No userId in token');
    return payload.sub;
  } catch (err: any) {
    console.error('[chats] verifyToken failed:', err?.message ?? err);
    throw Object.assign(new Error('Authentication failed'), { status: 401 });
  }
}

// ─── REDIS + BLOB HELPERS ────────────────────────────────────────────────────

function redis() {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

interface ChatMeta {
  id: string; userId: string; title: string;
  createdAt: number; updatedAt: number; messageCount: number;
}

function metaKey(chatId: string) { return `chat:${chatId}:meta`; }
function userKey(userId: string) { return `user:${userId}:chats`; }
function blobPath(userId: string, chatId: string) { return `chats/${userId}/${chatId}.json`; }

async function getMeta(kv: Redis, chatId: string): Promise<ChatMeta | null> {
  const raw = await kv.get<string>(metaKey(chatId));
  if (!raw) return null;
  return JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw)) as ChatMeta;
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  let userId: string;
  try {
    userId = await getUserId(req);
  } catch (e: any) {
    return res.status(e.status ?? 401).json({ error: e.message });
  }

  const chatId = req.query.id as string | undefined;
  const kv = redis();

  try {
    // ── LIST ──────────────────────────────────────────────────────────────────
    if (req.method === 'GET' && !chatId) {
      const limit = Math.min(Number(req.query.limit) || 50, 100);
      const offset = Number(req.query.offset) || 0;

      const ids = await kv.zrange(userKey(userId), offset, offset + limit - 1, { rev: true }) as string[];
      const metas = await Promise.all(
        ids.map(id => getMeta(kv, id))
      );
      return res.status(200).json({ chats: metas.filter(Boolean) });
    }

    // ── CREATE ────────────────────────────────────────────────────────────────
    if (req.method === 'POST' && !chatId) {
      const id = randomUUID();
      const now = Date.now();
      const meta: ChatMeta = {
        id, userId,
        title: (req.body?.title as string) || 'New chat',
        createdAt: now, updatedAt: now, messageCount: 0,
      };
      await Promise.all([
        kv.set(metaKey(id), JSON.stringify(meta)),
        kv.zadd(userKey(userId), { score: now, member: id }),
      ]);
      return res.status(201).json(meta);
    }

    // All remaining routes require chatId
    if (!chatId) return res.status(400).json({ error: 'id query param required' });

    // ── GET ONE ───────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const meta = await getMeta(kv, chatId);
      if (!meta || meta.userId !== userId) return res.status(404).json({ error: 'Not found' });

      let messages: ChatMessage[] = [];
      try {
        const blob = await head(blobPath(userId, chatId));
        if (blob) {
          const r = await fetch(blob.url);
          messages = await r.json();
        }
      } catch { /* no messages yet */ }

      return res.status(200).json({ ...meta, messages });
    }

    // ── SAVE ──────────────────────────────────────────────────────────────────
    if (req.method === 'PUT') {
      const { messages, title } = req.body ?? {};
      console.log(`[chats] PUT id=${chatId} msgCount=${Array.isArray(messages) ? messages.length : 'not-array'} title=${title}`);
      if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages array required' });

      const meta = await getMeta(kv, chatId);
      if (!meta || meta.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const now = Date.now();
      const updated: ChatMeta = { ...meta, title: title ?? meta.title, updatedAt: now, messageCount: messages.length };

      await put(blobPath(userId, chatId), JSON.stringify(messages), {
        access: 'public', contentType: 'application/json', addRandomSuffix: false,
      });
      await Promise.all([
        kv.set(metaKey(chatId), JSON.stringify(updated)),
        kv.zadd(userKey(userId), { score: now, member: chatId }),
      ]);
      console.log(`[chats] PUT saved ok id=${chatId} msgCount=${messages.length}`);
      return res.status(200).json(updated);
    }

    // ── RENAME ────────────────────────────────────────────────────────────────
    if (req.method === 'PATCH') {
      const { title } = req.body ?? {};
      if (!title) return res.status(400).json({ error: 'title required' });

      const meta = await getMeta(kv, chatId);
      if (!meta || meta.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const updated = { ...meta, title: String(title).slice(0, 100) };
      await kv.set(metaKey(chatId), JSON.stringify(updated));
      return res.status(200).json(updated);
    }

    // ── DELETE ────────────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const meta = await getMeta(kv, chatId);
      if (!meta || meta.userId !== userId) return res.status(403).json({ error: 'Forbidden' });

      await Promise.all([
        kv.del(metaKey(chatId)),
        kv.zrem(userKey(userId), chatId),
        del(blobPath(userId, chatId)).catch(() => {}),
      ]);
      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err: any) {
    console.error('[/api/chats]', err);
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
}
