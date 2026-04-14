/**
 * Authenticated fetch wrapper — attaches the Clerk session Bearer token
 * to every request going to /api/chats/* endpoints.
 */

import { useAuth } from '@clerk/clerk-react';
import { useCallback } from 'react';

export function useAuthFetch() {
  const { getToken } = useAuth();

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const token = await getToken();
      return fetch(url, {
        ...options,
        headers: {
          ...(options.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    },
    [getToken]
  );

  return authFetch;
}
