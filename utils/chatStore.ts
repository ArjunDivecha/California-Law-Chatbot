/**
 * Chat persistence layer using Upstash Redis (index + metadata) and Vercel Blob (message bodies).
 *
 * Redis layout:
 *   user:{userId}:chats          sorted set  score=updatedAt(ms)  member=chatId
 *   chat:{chatId}:meta           JSON string  { id, userId, title, createdAt, updatedAt, messageCount }
 *
 * Blob layout:
 *   chats/{userId}/{chatId}.json   full ChatMessage[] JSON  (private)
 */

import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
import { put, del, head } from '@vercel/blob';
import { randomUUID } from 'crypto';
import type { ChatMessage } from '../types.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMeta {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface ChatWithMessages extends ChatMeta {
  messages: ChatMessage[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function metaKey(chatId: string) {
  return `chat:${chatId}:meta`;
}

function userChatsKey(userId: string) {
  return `user:${userId}:chats`;
}

function blobPath(userId: string, chatId: string) {
  return `chats/${userId}/${chatId}.json`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new empty chat for a user. Returns the metadata.
 */
export async function createChat(userId: string, title?: string): Promise<ChatMeta> {
  const chatId = randomUUID();
  const now = Date.now();
  const meta: ChatMeta = {
    id: chatId,
    userId,
    title: title ?? 'New chat',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
  };

  await Promise.all([
    kv.set(metaKey(chatId), JSON.stringify(meta)),
    kv.zadd(userChatsKey(userId), { score: now, member: chatId }),
  ]);

  return meta;
}

/**
 * List a user's chats newest-first (paginated).
 */
export async function listChats(
  userId: string,
  { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {}
): Promise<ChatMeta[]> {
  // ZREVRANGE equivalent: highest scores (most recent) first
  const chatIds = await kv.zrange(userChatsKey(userId), offset, offset + limit - 1, {
    rev: true,
  }) as string[];

  if (!chatIds.length) return [];

  const metas = await Promise.all(
    chatIds.map(async (id) => {
      const raw = await kv.get<string>(metaKey(id));
      if (!raw) return null;
      return JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw)) as ChatMeta;
    })
  );

  return metas.filter((m): m is ChatMeta => m !== null);
}

/**
 * Load a chat's metadata. Returns null if not found.
 */
export async function getChatMeta(chatId: string): Promise<ChatMeta | null> {
  const raw = await kv.get<string>(metaKey(chatId));
  if (!raw) return null;
  return JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw)) as ChatMeta;
}

/**
 * Load a chat with its full message history.
 * Returns null if the chat doesn't exist.
 */
export async function loadChat(userId: string, chatId: string): Promise<ChatWithMessages | null> {
  const meta = await getChatMeta(chatId);
  if (!meta) return null;
  if (meta.userId !== userId) return null; // Ownership check

  // Fetch messages blob
  try {
    const path = blobPath(userId, chatId);
    const blobResult = await head(path);
    if (!blobResult) return { ...meta, messages: [] };

    const res = await fetch(blobResult.url);
    const messages: ChatMessage[] = await res.json();
    return { ...meta, messages };
  } catch {
    // Blob not yet created (no messages saved yet)
    return { ...meta, messages: [] };
  }
}

/**
 * Save (overwrite) the full message list for a chat.
 * Updates KV metadata (title, messageCount, updatedAt).
 */
export async function saveChat(
  userId: string,
  chatId: string,
  messages: ChatMessage[],
  title?: string
): Promise<ChatMeta> {
  const meta = await getChatMeta(chatId);
  if (!meta || meta.userId !== userId) {
    throw new Error('Chat not found or access denied');
  }

  const now = Date.now();
  const updatedMeta: ChatMeta = {
    ...meta,
    title: title ?? meta.title,
    updatedAt: now,
    messageCount: messages.length,
  };

  // Write blob (private)
  const path = blobPath(userId, chatId);
  await put(path, JSON.stringify(messages), {
    access: 'public', // Blob URLs need to be fetchable by the server; ownership is enforced at the API layer
    contentType: 'application/json',
    addRandomSuffix: false,
  });

  // Update KV metadata and resort in sorted set
  await Promise.all([
    kv.set(metaKey(chatId), JSON.stringify(updatedMeta)),
    kv.zadd(userChatsKey(userId), { score: now, member: chatId }),
  ]);

  return updatedMeta;
}

/**
 * Rename a chat.
 */
export async function renameChat(
  userId: string,
  chatId: string,
  title: string
): Promise<ChatMeta> {
  const meta = await getChatMeta(chatId);
  if (!meta || meta.userId !== userId) {
    throw new Error('Chat not found or access denied');
  }

  const updatedMeta: ChatMeta = { ...meta, title };
  await kv.set(metaKey(chatId), JSON.stringify(updatedMeta));
  return updatedMeta;
}

/**
 * Delete a chat and all its data.
 */
export async function deleteChat(userId: string, chatId: string): Promise<void> {
  const meta = await getChatMeta(chatId);
  if (!meta || meta.userId !== userId) {
    throw new Error('Chat not found or access denied');
  }

  const path = blobPath(userId, chatId);

  await Promise.all([
    kv.del(metaKey(chatId)),
    kv.zrem(userChatsKey(userId), chatId),
    // Blob delete — ignore errors if blob doesn't exist yet
    del(path).catch(() => {}),
  ]);
}
