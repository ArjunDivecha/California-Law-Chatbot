/**
 * Clerk authentication helper for Vercel serverless functions.
 *
 * Extracts the authenticated userId from an incoming request using the
 * Clerk backend SDK. Throws structured HTTP errors on missing/invalid sessions
 * so API handlers can call this once and proceed.
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

  const clerk = createClerkClient({ secretKey });

  // Pull the session token from Authorization header or __session cookie
  const authHeader = req.headers.authorization;
  const cookieHeader = req.headers.cookie ?? '';

  let sessionToken: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    sessionToken = authHeader.slice(7);
  } else {
    // Parse __session from cookie string
    const match = cookieHeader.match(/(?:^|;\s*)__session=([^;]+)/);
    sessionToken = match ? match[1] : undefined;
  }

  if (!sessionToken) {
    throw new AuthError('No session token provided', 401);
  }

  try {
    const requestState = await clerk.authenticateRequest(req as any, {
      jwtKey: process.env.CLERK_JWT_KEY,
      authorizedParties: process.env.CLERK_AUTHORIZED_PARTIES?.split(','),
    });

    const userId = requestState.toAuth()?.userId;
    if (!userId) {
      throw new AuthError('Invalid or expired session', 401);
    }
    return userId;
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError('Authentication failed', 401);
  }
}
