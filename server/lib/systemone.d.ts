export type SystemOneMessage = {
  role: string;
  content: string;
};

export type SystemOneLlmCall = (
  messages: SystemOneMessage[],
) => Promise<{ ok?: boolean; text?: string } | string>;

export type SystemOneAsker = {
  ask: (state: unknown, questions: Record<string, unknown>) => Promise<{
    answers: Record<string, unknown>;
    model?: string;
    usage?: Record<string, unknown>;
  }>;
};

export function makeLocalAsker(options?: {
  model?: string;
  llmCall?: SystemOneLlmCall;
}): SystemOneAsker;