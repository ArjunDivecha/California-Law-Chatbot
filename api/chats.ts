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
import { put, del, get } from '@vercel/blob';
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
  blobUrl?: string;
}

function metaKey(chatId: string) { return `chat:${chatId}:meta`; }
function userKey(userId: string) { return `user:${userId}:chats`; }
function blobPath(userId: string, chatId: string) { return `chats/${userId}/${chatId}.json`; }
function isBlobAlreadyExistsError(error: unknown): boolean {
  const message = String((error as any)?.message ?? error ?? '').toLowerCase();
  return message.includes('already exists');
}

function parseMessagesJson(input: string): ChatMessage[] | null {
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) ? parsed as ChatMessage[] : null;
  } catch {
    return null;
  }
}

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
      const verify = await kv.get(metaKey(id));
      console.log(`[chats] POST id=${id} userId=${userId} verifyStored=${verify ? 'YES' : 'NO'}`);
      return res.status(201).json(meta);
    }

    // All remaining routes require chatId
    if (!chatId) return res.status(400).json({ error: 'id query param required' });

    // ── GET ONE ───────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const meta = await getMeta(kv, chatId);
      if (!meta || meta.userId !== userId) return res.status(404).json({ error: 'Not found' });

      let messages: ChatMessage[] = [];
      const candidates = [blobPath(userId, chatId), meta.blobUrl].filter(
        (value, index, arr): value is string => !!value && arr.indexOf(value) === index
      );
      const attempts: Array<Record<string, unknown>> = [];
      try {
        for (const candidate of candidates) {
          const attempt: Record<string, unknown> = { candidate };
          try {
            const result = await get(candidate, { access: 'private', useCache: false });
            attempt.resultNull = !result;
            attempt.statusCode = result?.statusCode ?? null;
            attempt.hasStream = !!result?.stream;
            if (!result || result.statusCode !== 200 || !result.stream) {
              attempts.push(attempt);
              continue;
            }
            const body = await new Response(result.stream).text();
            attempt.bodyLength = body.length;
            const parsed = parseMessagesJson(body);
            attempt.parsedLen = parsed?.length ?? null;
            if (parsed) {
              messages = parsed;
              attempts.push(attempt);
              break;
            }
          } catch (inner: any) {
            attempt.error = inner?.message ?? String(inner);
          }
          attempts.push(attempt);
        }
      } catch (e: any) {
        console.error('[chats] GET blob read failed:', e);
      }
      console.log(`[chats] GET id=${chatId} metaBlobUrl=${meta.blobUrl ?? 'none'} attempts=${JSON.stringify(attempts)}`);
      return res.status(200).json({ ...meta, messages, _debug: { hasBlobUrl: !!meta.blobUrl, attempts } });
    }

    // ── SAVE (upsert) ─────────────────────────────────────────────────────────
    if (req.method === 'PUT') {
      const { messages, title } = req.body ?? {};
      console.log(`[chats] PUT id=${chatId} msgCount=${Array.isArray(messages) ? messages.length : 'not-array'} title=${title}`);
      if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages array required' });

      const existing = await getMeta(kv, chatId);
      // Ownership guard only applies if meta already exists; missing meta = auto-create
      if (existing && existing.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const now = Date.now();
      const base: ChatMeta = existing ?? {
        id: chatId, userId,
        title: title ?? 'New chat',
        createdAt: now, updatedAt: now, messageCount: 0,
      };
      const path = blobPath(userId, chatId);
      let blobResult;
      try {
        blobResult = await put(path, JSON.stringify(messages), {
          access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true,
        });
      } catch (error) {
        if (!isBlobAlreadyExistsError(error)) throw error;
        console.warn(`[chats] PUT overwrite fallback id=${chatId} path=${path} reason=${String((error as any)?.message ?? error)}`);
        await del(path).catch(() => {});
        blobResult = await put(path, JSON.stringify(messages), {
          access: 'private', contentType: 'application/json', addRandomSuffix: false,
        });
      }
      const updated: ChatMeta = { ...base, title: title ?? base.title, updatedAt: now, messageCount: messages.length, blobUrl: blobResult.url };
      await Promise.all([
        kv.set(metaKey(chatId), JSON.stringify(updated)),
        kv.zadd(userKey(userId), { score: now, member: chatId }),
      ]);
      console.log(`[chats] PUT saved ok id=${chatId} msgCount=${messages.length} upsert=${!existing}`);

      // ── Prune oldest chats if user exceeds cap ─────────────────────────────
      const MAX_CHATS = 100;
      const total = await kv.zcard(userKey(userId));
      if (total > MAX_CHATS) {
        const excess = total - MAX_CHATS;
        const oldest = await kv.zrange(userKey(userId), 0, excess - 1) as string[];
        if (oldest.length > 0) {
          await Promise.all([
            kv.zrem(userKey(userId), ...oldest),
            ...oldest.map(id => kv.del(metaKey(id))),
            ...oldest.map(id => del(blobPath(userId, id)).catch(() => {})),
          ]);
          console.log(`[chats] pruned ${oldest.length} old chats for user ${userId}`);
        }
      }

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
    const detail = {
      method: req.method,
      chatId: chatId || null,
      userIdSet: !!userId,
      errorName: err?.name,
      errorMessage: err?.message,
      errorStack: err?.stack,
      hasRedisUrl: !!process.env.UPSTASH_REDIS_REST_URL,
      hasRedisToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
      hasClerkSecret: !!process.env.CLERK_SECRET_KEY,
    };
    console.error('[/api/chats] FAILED', JSON.stringify(detail));
    return res.status(500).json({ error: err?.message ?? String(err), detail });
  }
}
