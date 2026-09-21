export type SystemOneMessage = {
  role: string;
  content: string;
};

export type SystemOneLlmCall = (
  messages: SystemOneMessage[],
) => Promise<{ ok?: boolean; text?: string } | string>;

export function makeLocalAsker(options?: {
  model?: string;
  llmCall?: SystemOneLlmCall;
}): (...args: any[]) => Promise<any>;