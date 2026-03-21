/**
 * Model pricing database -- cost per 1M tokens in USD.
 * Sources: official pricing pages (OpenAI, Anthropic, Google, Mistral, Cohere).
 * Last updated: 2026-03-22
 */

export interface ModelPricing {
  model: string
  provider: string
  input: number   // USD per 1M input tokens
  output: number  // USD per 1M output tokens
}

export const pricingDatabase: ModelPricing[] = [
  // OpenAI
  { model: 'gpt-4o', provider: 'openai', input: 2.50, output: 10.00 },
  { model: 'gpt-4o-mini', provider: 'openai', input: 0.15, output: 0.60 },
  { model: 'gpt-4o-2024-11-20', provider: 'openai', input: 2.50, output: 10.00 },
  { model: 'gpt-4-turbo', provider: 'openai', input: 10.00, output: 30.00 },
  { model: 'gpt-4', provider: 'openai', input: 30.00, output: 60.00 },
  { model: 'gpt-3.5-turbo', provider: 'openai', input: 0.50, output: 1.50 },
  { model: 'o1', provider: 'openai', input: 15.00, output: 60.00 },
  { model: 'o1-mini', provider: 'openai', input: 3.00, output: 12.00 },
  { model: 'o1-pro', provider: 'openai', input: 150.00, output: 600.00 },
  { model: 'o3-mini', provider: 'openai', input: 1.10, output: 4.40 },

  // Anthropic
  { model: 'claude-opus-4-6', provider: 'anthropic', input: 15.00, output: 75.00 },
  { model: 'claude-sonnet-4-6', provider: 'anthropic', input: 3.00, output: 15.00 },
  { model: 'claude-haiku-4-5', provider: 'anthropic', input: 0.80, output: 4.00 },
  { model: 'claude-3-5-sonnet-20241022', provider: 'anthropic', input: 3.00, output: 15.00 },
  { model: 'claude-3-5-haiku-20241022', provider: 'anthropic', input: 0.80, output: 4.00 },
  { model: 'claude-3-opus-20240229', provider: 'anthropic', input: 15.00, output: 75.00 },
  { model: 'claude-3-sonnet-20240229', provider: 'anthropic', input: 3.00, output: 15.00 },
  { model: 'claude-3-haiku-20240307', provider: 'anthropic', input: 0.25, output: 1.25 },

  // Google
  { model: 'gemini-2.5-pro', provider: 'google', input: 1.25, output: 10.00 },
  { model: 'gemini-2.5-flash', provider: 'google', input: 0.15, output: 0.60 },
  { model: 'gemini-2.0-flash', provider: 'google', input: 0.10, output: 0.40 },
  { model: 'gemini-1.5-pro', provider: 'google', input: 1.25, output: 5.00 },
  { model: 'gemini-1.5-flash', provider: 'google', input: 0.075, output: 0.30 },

  // Mistral
  { model: 'mistral-large-latest', provider: 'mistral', input: 2.00, output: 6.00 },
  { model: 'mistral-medium-latest', provider: 'mistral', input: 2.70, output: 8.10 },
  { model: 'mistral-small-latest', provider: 'mistral', input: 0.20, output: 0.60 },
  { model: 'codestral-latest', provider: 'mistral', input: 0.30, output: 0.90 },
  { model: 'open-mistral-nemo', provider: 'mistral', input: 0.15, output: 0.15 },
  { model: 'open-mixtral-8x22b', provider: 'mistral', input: 2.00, output: 6.00 },

  // Cohere
  { model: 'command-r-plus', provider: 'cohere', input: 2.50, output: 10.00 },
  { model: 'command-r', provider: 'cohere', input: 0.15, output: 0.60 },
  { model: 'command-light', provider: 'cohere', input: 0.30, output: 0.60 },

  // Meta (via providers)
  { model: 'llama-3.3-70b', provider: 'meta', input: 0.59, output: 0.79 },
  { model: 'llama-3.1-405b', provider: 'meta', input: 3.00, output: 3.00 },
  { model: 'llama-3.1-70b', provider: 'meta', input: 0.59, output: 0.79 },
  { model: 'llama-3.1-8b', provider: 'meta', input: 0.05, output: 0.08 },

  // DeepSeek
  { model: 'deepseek-chat', provider: 'deepseek', input: 0.14, output: 0.28 },
  { model: 'deepseek-reasoner', provider: 'deepseek', input: 0.55, output: 2.19 },

  // xAI
  { model: 'grok-2', provider: 'xai', input: 2.00, output: 10.00 },
  { model: 'grok-2-mini', provider: 'xai', input: 0.20, output: 1.00 },

  // Amazon
  { model: 'amazon.nova-pro-v1:0', provider: 'amazon', input: 0.80, output: 3.20 },
  { model: 'amazon.nova-lite-v1:0', provider: 'amazon', input: 0.06, output: 0.24 },
  { model: 'amazon.nova-micro-v1:0', provider: 'amazon', input: 0.035, output: 0.14 },
]

const pricingMap = new Map<string, ModelPricing>()
for (const entry of pricingDatabase) {
  pricingMap.set(entry.model, entry)
}

export function getModelPricing(model: string): ModelPricing | undefined {
  return pricingMap.get(model)
}

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = getModelPricing(model)
  if (!pricing) {
    return 0
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output

  return inputCost + outputCost
}

export function getProvider(model: string): string {
  return pricingMap.get(model)?.provider ?? 'unknown'
}

export function getAllModels(): string[] {
  return pricingDatabase.map(p => p.model)
}
