/**
 * Retry utility with exponential backoff
 * 
 * Retries failed requests with exponential backoff delay.
 * Does not retry client errors (4xx) but retries server errors (5xx) and network errors.
 * 
 * @param fn - Function that returns a Promise
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param initialDelay - Initial delay in milliseconds (default: 1000)
 * @param signal - Optional AbortController signal for cancellation
 * @returns Promise that resolves with the function result
 */
export async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
  signal?: AbortSignal
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check if request was cancelled
    if (signal?.aborted) {
      throw new Error('Request cancelled');
    }

    try {
      const result = await fn();
      return result;
    } catch (error: any) {
      // Don't retry if cancelled
      if (signal?.aborted || error.name === 'AbortError') {
        throw error;
      }

      // Don't retry client errors (4xx) - these are permanent failures
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error;
      }

      // Calculate exponential backoff: 1s, 2s, 4s, etc.
      const waitTime = initialDelay * Math.pow(2, attempt);
      console.log(`⚠️ Request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${waitTime}ms...`);

      // Wait with cancellation support
      await new Promise((resolve, reject) => {
        if (signal?.aborted) {
          reject(new Error('Request cancelled'));
          return;
        }

        const timeout = setTimeout(resolve, waitTime);
        signal?.addEventListener('abort', () => {
          clearTimeout(timeout);
          reject(new Error('Request cancelled'));
        });
      });
    }
  }

  throw new Error('Max retries exceeded');
}

/**
 * Wrapper for fetch with retry and cancellation support
 * 
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param maxRetries - Maximum retry attempts (default: 3)
 * @param initialDelay - Initial delay in milliseconds (default: 1000)
 * @returns Promise that resolves with Response
 */
export async function fetchWithRetryAndCancel(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<Response> {
  const signal = options.signal as AbortSignal | undefined;

  return fetchWithRetry(
    async () => {
      const response = await fetch(url, options);

      // Throw error for non-ok responses so retry logic can handle them
      if (!response.ok) {
        const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        error.response = response;
        throw error;
      }

      return response;
    },
    maxRetries,
    initialDelay,
    signal
  );
}
