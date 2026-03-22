/**
 * Example: Nuxt 3 server API route with ai-armor
 *
 * Production pattern for a Nuxt 3 server route at
 * server/api/chat.post.ts. Uses H3's getHeader and readBody
 * for request handling with ai-armor protection.
 *
 * npm install ai-armor openai
 */

import { createArmor } from 'ai-armor'
import {
  createError,
  defineEventHandler,
  getHeader,
  getRequestIP,
  readBody,
} from 'h3'
import OpenAI from 'openai'

// --- Module-level armor singleton ---
const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [
      { key: 'user', limit: 30, window: '1m' },
      { key: 'ip', limit: 60, window: '1m' },
    ],
  },
  budget: {
    daily: 150.0,
    perUser: 20.0,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'gpt-4o': 'gpt-4o-mini',
      'claude-sonnet-4-20250514': 'claude-haiku-4-5-20251001',
      'gemini-2.5-pro': 'gemini-2.5-flash',
    },
  },
  cache: {
    enabled: true,
    strategy: 'exact',
    ttl: 1800,
    driver: 'memory',
    maxSize: 2000,
  },
  routing: {
    aliases: {
      fast: 'gpt-4o-mini',
      smart: 'gpt-4o',
      claude: 'claude-sonnet-4-20250514',
      gemini: 'gemini-2.5-pro',
    },
  },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency', 'cached', 'userId'],
  },
})

const openai = new OpenAI()

// --- Nuxt 3 server route: POST /api/chat ---
export default defineEventHandler(async (event) => {
  // 1. Extract user info from H3 event
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const userId = authHeader.slice(7) // In production: verify JWT
  const ip = getRequestIP(event) ?? 'unknown'

  // 2. Read and validate body
  const body = await readBody<{ model?: string, message?: string }>(event)
  if (!body?.message) {
    throw createError({ statusCode: 400, statusMessage: 'Missing "message" field' })
  }
  const { model = 'fast', message } = body

  const ctx = { userId, ip }

  // 3. Rate limit
  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many requests',
      data: { retryAfter: new Date(rateLimit.resetAt).toISOString() },
    })
  }

  // 4. Resolve model + budget
  const resolvedModel = armor.resolveModel(model)
  const budget = await armor.checkBudget(resolvedModel, ctx)
  if (!budget.allowed) {
    throw createError({
      statusCode: 402,
      statusMessage: 'Budget exceeded',
      data: { action: budget.action },
    })
  }
  const finalModel = budget.suggestedModel ?? resolvedModel

  // 5. Cache check
  const request = { model: finalModel, messages: [{ role: 'user' as const, content: message }] }
  const cached = armor.getCachedResponse(request)
  if (cached) {
    return { ...(cached as { content: string }), model: finalModel, cached: true }
  }

  // 6. Call OpenAI
  const start = Date.now()
  const completion = await openai.chat.completions.create({
    model: finalModel,
    messages: [{ role: 'user', content: message }],
    max_tokens: 2048,
  })
  const latency = Date.now() - start

  const content = completion.choices[0]?.message?.content ?? ''
  const inputTokens = completion.usage?.prompt_tokens ?? 0
  const outputTokens = completion.usage?.completion_tokens ?? 0
  const cost = armor.estimateCost(finalModel, inputTokens, outputTokens)

  // 7. Post-request tracking
  await armor.trackCost(finalModel, inputTokens, outputTokens, userId)
  armor.setCachedResponse(request, { content })

  await armor.log({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    model: finalModel,
    provider: 'openai',
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
    usage: { inputTokens, outputTokens, cost: `$${cost.toFixed(4)}` },
  }
})
