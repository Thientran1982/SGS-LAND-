// server/bot-detector.ts

const BOT_PATTERNS = [
  // Search Engines
  /googlebot/i,
  /bingbot/i,
  /yandexbot/i,
  /duckduckbot/i,
  /baiduspider/i,
  /slurp/i, // Yahoo

  // AI Crawlers — QUAN TRỌNG CHO GEO
  /gptbot/i,
  /claude-web/i,
  /anthropic-ai/i,
  /claudebot/i,
  /perplexitybot/i,
  /gemini/i,
  /cohere-ai/i,
  /meta-externalagent/i,
  /youbot/i,

  // SEO Tools
  /semrushbot/i,
  /ahrefsbot/i,
  /mj12bot/i,
  /dotbot/i,
  /rogerbot/i,

  // Social Crawlers (OG preview)
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /zalo/i,

  // Lighthouse / PageSpeed
  /lighthouse/i,
  /chrome-lighthouse/i,
];

export function isBot(userAgent: string): boolean {
  if (!userAgent) return false;
  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

export function isSocialBot(userAgent: string): boolean {
  return /facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|zalo/i.test(userAgent);
}

export function isSearchBot(userAgent: string): boolean {
  return /googlebot|bingbot|yandexbot|duckduckbot|baiduspider/i.test(userAgent);
}

export function isAIBot(userAgent: string): boolean {
  return /gptbot|claude-web|anthropic-ai|claudebot|perplexitybot|gemini|cohere-ai/i.test(userAgent);
}
