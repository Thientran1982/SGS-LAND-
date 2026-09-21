export function compact(
  messages: any[],
  asker: (...args: any[]) => Promise<any>,
  options?: Record<string, unknown>,
): Promise<any>;