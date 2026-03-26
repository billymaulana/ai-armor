/**
 * Example: ai-armor with DeepSeek AI (OpenAI-compatible API)
 *
 * DeepSeek exposes an OpenAI-compatible endpoint, so you can use the
 * OpenAI SDK with a custom baseURL. This example shows deepseek-chat
 * and deepseek-reasoner with budget-driven downgrade chains.
 *
 * npm install ai-armor openai
 */

import process from 'node:process'
import { createArmor } from 'ai-armor'
import OpenAI from 'openai'

// --- DeepSeek client (OpenAI-compatible) ---
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
})

// --- Armor with DeepSeek pricing awareness ---
const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [
      { key: 'user', limit: 40, window: '1m' },
    ],
  },
  budget: {
    daily: 20.0,
    perUser: 5.0,
    onExceeded: 'downgrade-model',
    // Downgrade chain: reasoner -> chat (cheaper)
    // If even chat is over budget, armor blocks
    downgradeMap: {
      'deepseek-reasoner': 'deepseek-chat',
    },
  },
  cache: {
    enabled: true,
    strategy: 'exact',
    ttl: 3600,
    maxSize: 2000,
  },
  routing: {
    aliases: {
      fast: 'deepseek-chat',
      reasoning: 'deepseek-reasoner',
    },
  },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency', 'cached', 'userId'],
  },
})

// --- Protected DeepSeek chat ---
async function deepseekChat(userId: string, model: string, message: string) {
  const ctx = { userId }

  // Rate limit
  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed) {
    return { error: 'rate_limited', retryAfter: new Date(rateLimit.resetAt).toISOString() }
  }

  // Resolve + budget
  const resolvedModel = armor.resolveModel(model)
  const budget = await armor.checkBudget(resolvedModel, ctx)
  if (!budget.allowed) {
    return { error: 'budget_exceeded' }
  }
  const finalModel = budget.suggestedModel ?? resolvedModel
  const wasDowngraded = finalModel !== resolvedModel

  // Cache
  const request = { model: finalModel, messages: [{ role: 'user' as const, content: message }] }
  const cached = armor.getCachedResponse(request)
  if (cached) {
    return { ...(cached as { content: string, reasoningContent?: string }), model: finalModel, cached: true }
  }

  // Call DeepSeek
  const start = Date.now()
  const completion = await deepseek.chat.completions.create({
    model: finalModel,
    messages: [{ role: 'user', content: message }],
    max_tokens: finalModel === 'deepseek-reasoner' ? 4096 : 2048,
  })
  const latency = Date.now() - start

  const choice = completion.choices[0]
  const content = choice?.message?.content ?? ''

  // DeepSeek reasoner returns reasoning_content in the response
  const reasoningContent = (choice?.message as { reasoning_content?: string })?.reasoning_content

  const inputTokens = completion.usage?.prompt_tokens ?? 0
  const outputTokens = completion.usage?.completion_tokens ?? 0
  const cost = armor.estimateCost(finalModel, inputTokens, outputTokens)

  // Track + cache + log
  await armor.trackCost(finalModel, inputTokens, outputTokens, userId)

  const responsePayload = { content, ...(reasoningContent ? { reasoningContent } : {}) }
  armor.setCachedResponse(request, responsePayload)

  await armor.log({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    model: finalModel,
    provider: 'deepseek',
    inputTokens,
    outputTokens,
    cost,
    latency,
    cached: false,
    fallback: wasDowngraded,
    rateLimited: false,
    userId,
  })

  return {
    ...responsePayload,
    model: finalModel,
    cached: false,
    downgraded: wasDowngraded,
    cost: `$${cost.toFixed(4)}`,
  }
}

// --- Usage ---
async function main() {
  // Use deepseek-reasoner for complex reasoning tasks
  const _reasoning = await deepseekChat(
    'user-dev-1',
    'reasoning',
    'Prove that the square root of 2 is irrational.',
  )
  // eslint-disable-next-line no-console
  console.log('[reasoner]', _reasoning)

  // Use deepseek-chat for general conversation (cheaper)
  const _chat = await deepseekChat(
    'user-dev-1',
    'fast',
    'Summarize the key features of Rust programming language.',
  )
  // eslint-disable-next-line no-console
  console.log('[chat]', _chat)

  // Show cost summary
  const logs = armor.getLogs()
  const totalCost = logs.reduce((sum, l) => sum + l.cost, 0)
  // eslint-disable-next-line no-console
  console.log(`[summary] ${logs.length} requests, total=$${totalCost.toFixed(4)}`)
}

main()
