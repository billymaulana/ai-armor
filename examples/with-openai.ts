/**
 * Example: ai-armor with OpenAI SDK
 *
 * Protects OpenAI API calls with rate limiting, budget controls,
 * caching, and automatic model downgrading when budget is tight.
 *
 * npm install ai-armor openai
 */

import { createArmor } from 'ai-armor'
import OpenAI from 'openai'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [
      { key: 'user', limit: 30, window: '1m' },
      { key: 'apiKey', limit: 100, window: '1m' },
    ],
  },
  budget: {
    daily: 100.0,
    perUser: 20.0,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'gpt-4o': 'gpt-4o-mini',
      'o1': 'o1-mini',
    },
  },
  cache: {
    enabled: true,
    strategy: 'exact',
    ttl: 1800, // 30 minutes
    driver: 'memory',
    maxSize: 500,
  },
  routing: {
    aliases: {
      fast: 'gpt-4o-mini',
      smart: 'gpt-4o',
      reasoning: 'o1',
    },
  },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency', 'cached', 'userId'],
  },
})

const openai = new OpenAI()

async function chat(userId: string, model: string, message: string) {
  const ctx = { userId }

  // Rate limit
  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed) {
    throw new Error(`Rate limited. Retry after ${new Date(rateLimit.resetAt).toISOString()}`)
  }

  // Resolve alias + budget check
  const resolvedModel = armor.resolveModel(model)
  const budget = await armor.checkBudget(resolvedModel, ctx)
  if (!budget.allowed) {
    throw new Error('Budget exceeded')
  }
  const finalModel = budget.suggestedModel ?? resolvedModel

  // Cache check
  const request = { model: finalModel, messages: [{ role: 'user' as const, content: message }] }
  const cached = armor.getCachedResponse(request)
  if (cached) {
    return cached as { content: string }
  }

  // Call OpenAI
  const start = Date.now()
  const response = await openai.chat.completions.create({
    model: finalModel,
    messages: [{ role: 'user', content: message }],
    max_tokens: 1024,
  })
  const latency = Date.now() - start

  const content = response.choices[0]?.message?.content ?? ''
  const inputTokens = response.usage?.prompt_tokens ?? 0
  const outputTokens = response.usage?.completion_tokens ?? 0

  // Track cost + cache + log
  await armor.trackCost(finalModel, inputTokens, outputTokens, userId)
  armor.setCachedResponse(request, { content })

  await armor.log({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    model: finalModel,
    provider: 'openai',
    inputTokens,
    outputTokens,
    cost: armor.estimateCost(finalModel, inputTokens, outputTokens),
    latency,
    cached: false,
    fallback: false,
    rateLimited: false,
    userId,
  })

  return { content }
}

async function main() {
  const result = await chat('user-456', 'smart', 'What is TypeScript?')
  // eslint-disable-next-line no-console
  console.log(result.content)
}

main()
