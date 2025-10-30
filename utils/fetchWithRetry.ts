/**
 * Retry utility with exponential backoff
 * 
 * INPUT FILES: None
 * OUTPUT FILES: None (utility function)
 * 
 * Retries a fetch request with exponential backoff for transient failures.
 * Does not retry client errors (4xx) or cancelled requests.
 * 
 * @param url - The URL to fetch
 * @param options - Fetch options including signal for cancellation
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @returns Promise that resolves to the Response
 * @throws Error if all retries are exhausted or request is aborted
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<Response> {
  // Check if request was already aborted
  if (options.signal?.aborted) {
    throw new Error('Request cancelled');
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Success - return immediately
      if (response.ok) {
        return response;
      }
      
      // Check if request was cancelled during fetch
      if (options.signal?.aborted) {
        throw new Error('Request cancelled');
      }
      
      // Don't retry client errors (4xx) - these are user errors, not transient
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error: ${response.status} ${response.statusText}`);
      }
      
      // Retry server errors (5xx) and network errors
      // On last attempt, throw the error
      if (attempt === maxRetries) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
      
      // Calculate exponential backoff delay: 1s, 2s, 4s...
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`⚠️ Request failed (${response.status}), retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
      
      // Wait before retry, but check for cancellation periodically
      await new Promise<void>((resolve, reject) => {
        if (options.signal?.aborted) {
          reject(new Error('Request cancelled'));
          return;
        }
        
        const timeoutId = setTimeout(() => {
          if (options.signal?.aborted) {
            reject(new Error('Request cancelled'));
          } else {
            resolve();
          }
        }, delay);
        
        // Cancel timeout if request is aborted
        options.signal?.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new Error('Request cancelled'));
        });
      });
      
    } catch (error: any) {
      // Check if request was cancelled
      if (options.signal?.aborted || error.message === 'Request cancelled') {
        throw new Error('Request cancelled');
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Network errors should be retried
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`⚠️ Request failed (${error.message}), retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
      
      // Wait before retry
      await new Promise<void>((resolve, reject) => {
        if (options.signal?.aborted) {
          reject(new Error('Request cancelled'));
          return;
        }
        
        const timeoutId = setTimeout(() => {
          if (options.signal?.aborted) {
            reject(new Error('Request cancelled'));
          } else {
            resolve();
          }
        }, delay);
        
        options.signal?.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new Error('Request cancelled'));
        });
      });
    }
  }
  
  throw new Error('Max retries exceeded');
}
