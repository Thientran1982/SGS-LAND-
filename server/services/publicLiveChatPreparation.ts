import { isTransientDatabaseError } from '../dbHealth';

export interface PublicLiveChatPreparationDependencies {
  findLead: (tenantId: string, leadId: string) => Promise<any>;
  findHistory: (tenantId: string, leadId: string) => Promise<any[]>;
  findInboundForAgentRun: (
    tenantId: string,
    leadId: string,
    options: { content: string },
  ) => Promise<any | null>;
}

export interface PublicLiveChatPreparationOptions {
  tenantId: string;
  leadId: string;
  message: string;
  inboundInteractionId?: string;
  dependencies: PublicLiveChatPreparationDependencies;
  maxAttempts?: number;
  retryDelaysMs?: number[];
  onRetry?: (details: { attempt: number; nextAttempt: number; delayMs: number }) => void;
}

export interface PublicLiveChatPreparationResult {
  lead: any;
  history: any[];
  inboundInteraction: any | null;
}

/**
 * Load the minimum public-chat context without opening an unnecessary third
 * RLS transaction for the already-persisted inbound interaction.
 *
 * The public widget acknowledges before this work completes, so transient pool
 * exhaustion should be retried here rather than immediately becoming a
 * terminal AI_UNAVAILABLE reply.
 */
export async function preparePublicLiveChat(
  options: PublicLiveChatPreparationOptions,
): Promise<PublicLiveChatPreparationResult> {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 3));
  const retryDelaysMs = options.retryDelaysMs ?? [250, 750];
  let history: any[] = [];
  let lead: any;
  let inboundInteraction: any | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const [preparedLead, preparedHistory] = await Promise.all([
        options.dependencies.findLead(options.tenantId, options.leadId),
        options.dependencies.findHistory(options.tenantId, options.leadId),
      ]);
      lead = preparedLead;
      history = preparedHistory || [];
      inboundInteraction = options.inboundInteractionId
        ? history.find((item: any) => String(item?.id) === options.inboundInteractionId) || null
        : await options.dependencies.findInboundForAgentRun(
            options.tenantId,
            options.leadId,
            { content: options.message },
          );
      break;
    } catch (error) {
      if (!isTransientDatabaseError(error) || attempt >= maxAttempts - 1) {
        throw error;
      }
      const delayMs = retryDelaysMs[attempt]
        ?? retryDelaysMs.at(-1)
        ?? 750;
      options.onRetry?.({
        attempt: attempt + 1,
        nextAttempt: attempt + 2,
        delayMs,
      });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { lead, history, inboundInteraction };
}