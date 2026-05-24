export interface PromptVariant {
  id: string;
  agentId: string;
  systemPromptSuffix: string;
  fitnessScore: number;
  generationCount: number;
  wins: number;
  losses: number;
  createdAt: Date;
}

export interface FeedbackEvent {
  sessionId: string;
  messageId: string;
  agentId: string;
  variantId: string;
  rating: 'positive' | 'negative' | 'neutral';
  timestamp: Date;
}
