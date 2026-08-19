const DEFAULT_TIMEOUT_MS = 10_000;

export function isTransientSubagentError(error: any): boolean {
  const message = String(error?.message || error).toLowerCase();
  return Boolean(
    error?.code === 'ETIMEDOUT' ||
    error?.code === 'ECONNRESET' ||
    /timeout|timed out|temporar|unavailable|429|5\d\d/.test(message),
  );
}

export async function runWithSubagentPolicy<T>(
  execute: () => Promise<T>,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const timeoutMs = Math.max(100, options.timeoutMs || DEFAULT_TIMEOUT_MS);
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          const error = new Error('SUBAGENT_TIMEOUT');
          (error as any).code = 'ETIMEDOUT';
          reject(error);
        }, timeoutMs);
        execute().then(
          value => {
            clearTimeout(timer);
            resolve(value);
          },
          error => {
            clearTimeout(timer);
            reject(error);
          },
        );
      });
    } catch (error) {
      lastError = error;
      if (attempt === 0 && isTransientSubagentError(error)) {
        await new Promise(resolve => setTimeout(resolve, 150));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}