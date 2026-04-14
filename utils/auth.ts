/**
 * Clerk authentication helper for Vercel serverless functions.
 *
 * Extracts the Bearer token from the Authorization header and verifies
 * it using Clerk's verifyToken — works with Node.js VercelRequest objects
 * without needing a Web API Request.
 */

import { createClerkClient } from '@clerk/backend';
import type { VercelRequest } from '@vercel/node';

export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

/**
 * Returns the authenticated Clerk userId for the request.
 * Throws AuthError(401) if no valid session is found.
 */
export async function getUserId(req: VercelRequest): Promise<string> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new AuthError('CLERK_SECRET_KEY is not configured', 500);
  }

  // Extract token from Authorization header or __session cookie
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else {
    const cookieHeader = req.headers.cookie ?? '';
    const match = cookieHeader.match(/(?:^|;\s*)__session=([^;]+)/);
    token = match ? decodeURIComponent(match[1]) : undefined;
  }

  if (!token) {
    throw new AuthError('No session token provided', 401);
  }

  try {
    const clerk = createClerkClient({ secretKey });
    const payload = await clerk.verifyToken(token);
    const userId = payload.sub;
    if (!userId) {
      throw new AuthError('Invalid session token', 401);
    }
    return userId;
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError('Authentication failed', 401);
  }
}
