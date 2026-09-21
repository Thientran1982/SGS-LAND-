export type JevAsker = {
  ask: (state: unknown, questions: Record<string, unknown>) => Promise<unknown>;
};

export function compact(
  messages: any[],
  asker: JevAsker,
  options?: Record<string, unknown>,
): Promise<any>;