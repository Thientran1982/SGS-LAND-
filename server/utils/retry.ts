import { logger } from '../middleware/logger';

/**
 * Exponential backoff retry utility.
 * Retries the given async fn up to `attempts` times on transient failures.
 *
 * @param fn       - Async function to retry
 * @param attempts - Max number of attempts (default 3)
 * @param delay    - Initial delay in ms (default 2000); doubles each retry
 * @param isTransient - Optional predicate: return false to NOT retry on certain errors
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delay = 2000,
  isTransient: (err: any) => boolean = () => true
): Promise<T> {
  let lastErr: any;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      if (attempt === attempts || !isTransient(err)) {
        throw err;
      }
      const wait = delay * Math.pow(2, attempt - 1);
      logger.warn(`[retry] Attempt ${attempt}/${attempts} failed: ${err.message}. Retrying in ${wait}ms…`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw lastErr;
}

/**
 * Predicate: treat network/timeout errors as transient (worth retrying).
 * Application-level errors (4xx, auth failures) are not retried.
 */
export function isTransientError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  // Network / DNS / timeout errors
  if (
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('enotfound') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('socket hang up')
  ) {
    return true;
  }
  // HTTP 5xx responses are transient; 4xx are not
  const status = err?.status || err?.statusCode || 0;
  if (status >= 500) return true;
  return false;
}
