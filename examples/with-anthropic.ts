/**
 * Example: ai-armor with Anthropic Claude SDK
 *
 * Protects Claude API calls with rate limiting, budget controls,
 * caching, and cost tracking.
 *
 * npm install ai-armor @anthropic-ai/sdk
 */

import Anthropic from '@anthropic-ai/sdk'
import { createArmor } from 'ai-armor'

// --- Setup ai-armor ---
const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [
      { key: 'user', limit: 60, window: '1m' },
      { key: 'ip', limit: 100, window: '1m' },
    ],
  },
  budget: {
    daily: 50.0, // $50/day
    monthly: 500.0, // $500/month
    perUser: 10.0, // $10/user/day
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'claude-opus-4-20250514': 'claude-sonnet-4-20250514',
      'claude-sonnet-4-20250514': 'claude-haiku-4-5-20251001',
    },
  },
  cache: {
    enabled: true,
    strategy: 'exact',
    ttl: 3600,
    maxSize: 1000,
  },
  routing: {
    aliases: {
      fast: 'claude-haiku-4-5-20251001',
      balanced: 'claude-sonnet-4-20250514',
      best: 'claude-opus-4-20250514',
    },
  },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency', 'cached', 'userId'],
  },
})

const client = new Anthropic()

// --- Protected chat function ---
async function chat(userId: string, model: string, message: string) {
  const ctx = { userId }

  // 1. Check rate limit
  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed) {
    throw new Error(`Rate limited. Retry after ${new Date(rateLimit.resetAt).toISOString()}`)
  }

  // 2. Resolve model alias
  const resolvedModel = armor.resolveModel(model)

  // 3. Check budget (may downgrade model)
  const budget = await armor.checkBudget(resolvedModel, ctx)
  if (!budget.allowed) {
    throw new Error('Budget exceeded')
  }
  const finalModel = budget.suggestedModel ?? resolvedModel

  // 4. Check cache
  const request = { model: finalModel, messages: [{ role: 'user', content: message }] }
  const cached = armor.getCachedResponse(request)
  if (cached) {
    return cached as { content: string }
  }

  // 5. Call Anthropic API
  const start = Date.now()
  const response = await client.messages.create({
    model: finalModel,
    max_tokens: 1024,
    messages: [{ role: 'user', content: message }],
  })
  const latency = Date.now() - start

  const content = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const { input_tokens, output_tokens } = response.usage

  // 6. Track cost
  await armor.trackCost(finalModel, input_tokens, output_tokens, userId)

  // 7. Cache response
  armor.setCachedResponse(request, { content })

  // 8. Log
  await armor.log({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    model: finalModel,
    provider: 'anthropic',
    inputTokens: input_tokens,
    outputTokens: output_tokens,
    cost: armor.estimateCost(finalModel, input_tokens, output_tokens),
    latency,
    cached: false,
    fallback: false,
    rateLimited: false,
    userId,
  })

  return { content }
}

// --- Usage ---
async function main() {
  const result = await chat('user-123', 'balanced', 'Explain quantum computing in one sentence.')
  // eslint-disable-next-line no-console
  console.log(result.content)

  // Second identical call hits cache (no API call)
  const cached = await chat('user-123', 'balanced', 'Explain quantum computing in one sentence.')
  // eslint-disable-next-line no-console
  console.log('(cached)', cached.content)
}

main()
