/**
 * Example: ai-armor with xAI Grok (OpenAI-compatible API)
 *
 * xAI's Grok models are accessible via an OpenAI-compatible endpoint.
 * This example shows grok-2 and grok-2-mini with rate limiting
 * and budget-driven model selection.
 *
 * npm install ai-armor openai
 */

import process from 'node:process'
import { createArmor } from 'ai-armor'
import OpenAI from 'openai'

// --- xAI Grok client (OpenAI-compatible) ---
const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
})

// --- Armor config for xAI ---
const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [
      { key: 'user', limit: 30, window: '1m' },
      { key: 'apiKey', limit: 120, window: '1m' },
    ],
  },
  budget: {
    daily: 50.0,
    perUser: 10.0,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'grok-2': 'grok-2-mini',
    },
  },
  cache: {
    enabled: true,
    strategy: 'exact',
    ttl: 1800,
    maxSize: 1000,
  },
  routing: {
    aliases: {
      fast: 'grok-2-mini',
      smart: 'grok-2',
    },
  },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency', 'cached', 'userId'],
  },
})

// --- Protected Grok chat ---
async function grokChat(userId: string, model: string, message: string) {
  const ctx = { userId }

  // Rate limit
  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed) {
    return {
      error: 'rate_limited',
      retryAfter: new Date(rateLimit.resetAt).toISOString(),
      remaining: rateLimit.remaining,
    }
  }

  // Resolve alias + budget
  const resolvedModel = armor.resolveModel(model)
  const budget = await armor.checkBudget(resolvedModel, ctx)
  if (!budget.allowed) {
    return { error: 'budget_exceeded' }
  }
  const finalModel = budget.suggestedModel ?? resolvedModel

  // Cache
  const request = { model: finalModel, messages: [{ role: 'user' as const, content: message }] }
  const cached = armor.getCachedResponse(request)
  if (cached) {
    return { ...(cached as { content: string }), model: finalModel, cached: true }
  }

  // Call xAI Grok
  const start = Date.now()
  const completion = await xai.chat.completions.create({
    model: finalModel,
    messages: [{ role: 'user', content: message }],
    max_tokens: 2048,
  })
  const latency = Date.now() - start

  const content = completion.choices[0]?.message?.content ?? ''
  const inputTokens = completion.usage?.prompt_tokens ?? 0
  const outputTokens = completion.usage?.completion_tokens ?? 0
  const cost = armor.estimateCost(finalModel, inputTokens, outputTokens)

  // Track + cache + log
  await armor.trackCost(finalModel, inputTokens, outputTokens, userId)
  armor.setCachedResponse(request, { content })

  await armor.log({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    model: finalModel,
    provider: 'xai',
    inputTokens,
    outputTokens,
    cost,
    latency,
    cached: false,
    fallback: finalModel !== resolvedModel,
    rateLimited: false,
    userId,
  })

  return {
    content,
    model: finalModel,
    cached: false,
    cost: `$${cost.toFixed(4)}`,
  }
}

// --- Usage ---
async function main() {
  // Use grok-2 for high-quality responses
  const _full = await grokChat('user-x1', 'smart', 'Explain the attention mechanism in transformers.')
  // eslint-disable-next-line no-console
  console.log('[grok-2]', _full)

  // Use grok-2-mini for fast, cheaper responses
  const _mini = await grokChat('user-x1', 'fast', 'What is a neural network?')
  // eslint-disable-next-line no-console
  console.log('[grok-2-mini]', _mini)

  // Second identical call hits cache
  const _cached = await grokChat('user-x1', 'fast', 'What is a neural network?')
  // eslint-disable-next-line no-console
  console.log('[cached]', _cached)

  // Stats
  const logs = armor.getLogs()
  const totalCost = logs.reduce((sum, l) => sum + l.cost, 0)
  const cacheHits = logs.filter(l => l.cached).length
  // eslint-disable-next-line no-console
  console.log(`[stats] requests=${logs.length} cost=$${totalCost.toFixed(4)} cacheHits=${cacheHits}`)
}

main()
