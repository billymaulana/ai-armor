/**
 * Mock AI responses for playground demo.
 * No API key needed -- simulates realistic token counts and latency.
 */

const responses: Record<string, string> = {
  default: 'This is a simulated AI response from the ai-armor playground. In production, this would come from your AI provider (OpenAI, Anthropic, Google, etc.) with full rate limiting, cost tracking, and safety protection applied by ai-armor.',
  greeting: 'Hello! I\'m a simulated AI assistant running through ai-armor protection. Every request is rate-limited, budget-checked, and safety-scanned before reaching the AI provider.',
  code: '```typescript\nimport { createArmor } from \'ai-armor\'\n\nconst armor = createArmor({\n  rateLimit: { strategy: \'sliding-window\', rules: [{ key: \'user\', limit: 20, window: \'1m\' }] },\n  budget: { daily: 50, onExceeded: \'warn\' },\n})\n```\nThis creates a production-ready AI armor instance with rate limiting and budget controls.',
  safety: 'I cannot process that request. ai-armor\'s safety guardrails detected a potential prompt injection attempt. The request was blocked before reaching the AI provider, protecting your system from malicious inputs.',
}

function pickResponse(prompt: string): string {
  const lower = prompt.toLowerCase()
  if (lower.includes('hello') || lower.includes('hi'))
    return responses.greeting
  if (lower.includes('code') || lower.includes('example'))
    return responses.code
  return responses.default
}

export function mockAIGenerate(prompt: string, model: string): {
  content: string
  inputTokens: number
  outputTokens: number
  latency: number
} {
  const content = pickResponse(prompt)
  // Approximate token counts (1 token ~ 4 chars)
  const inputTokens = Math.ceil(prompt.length / 4)
  const outputTokens = Math.ceil(content.length / 4)
  // Simulate latency based on model tier
  const latency = model.includes('mini') || model.includes('flash') || model.includes('haiku')
    ? 150 + Math.random() * 200
    : 300 + Math.random() * 500

  return { content, inputTokens, outputTokens, latency: Math.round(latency) }
}
