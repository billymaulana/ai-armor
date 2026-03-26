/**
 * Example: Fastify server with ai-armor as a preHandler hook
 *
 * Production pattern for Fastify with ai-armor enforcing rate limiting
 * and budget checks via a preHandler hook. All AI routes are protected
 * automatically before reaching the route handler.
 *
 * npm install ai-armor fastify openai
 */

import { createArmor } from 'ai-armor'
import Fastify from 'fastify'
import OpenAI from 'openai'

// --- Armor setup ---
const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [
      { key: 'user', limit: 30, window: '1m' },
      { key: 'ip', limit: 100, window: '1m' },
    ],
  },
  budget: {
    daily: 150.0,
    perUser: 20.0,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'gpt-4o': 'gpt-4o-mini',
      'o1': 'o3-mini',
      'claude-sonnet-4-20250514': 'claude-haiku-4-5-20251001',
    },
  },
  cache: {
    enabled: true,
    strategy: 'exact',
    ttl: 1800,
    maxSize: 2000,
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
const fastify = Fastify({ logger: true })

// --- Fastify preHandler hook for ai-armor ---
fastify.addHook('preHandler', async (request, reply) => {
  // Only apply to AI routes
  if (!request.url.startsWith('/api/ai'))
    return

  const userId = (request.headers['x-user-id'] as string) ?? 'anonymous'
  const ip = (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? request.ip
  const ctx = { userId, ip }

  // Rate limit
  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed) {
    reply.code(429).header('Retry-After', String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)))
    return reply.send({
      error: 'Too many requests',
      retryAfter: new Date(rateLimit.resetAt).toISOString(),
    })
  }

  // Attach context for downstream route handlers
  request.armorCtx = ctx
  request.armorUserId = userId
})

// --- Extend Fastify request type ---
declare module 'fastify' {
  interface FastifyRequest {
    armorCtx: { userId: string, ip: string }
    armorUserId: string
  }
}

// --- POST /api/ai/chat ---
fastify.post<{
  Body: { model?: string, message: string }
}>('/api/ai/chat', async (request, reply) => {
  const { armorCtx: ctx, armorUserId: userId } = request
  const { model = 'fast', message } = request.body

  if (!message) {
    return reply.code(400).send({ error: 'Missing "message" field' })
  }

  // Resolve + budget
  const resolvedModel = armor.resolveModel(model)
  const budget = await armor.checkBudget(resolvedModel, ctx)
  if (!budget.allowed) {
    return reply.code(402).send({ error: 'Budget exceeded', action: budget.action })
  }
  const finalModel = budget.suggestedModel ?? resolvedModel

  // Cache
  const armorRequest = { model: finalModel, messages: [{ role: 'user' as const, content: message }] }
  const cached = armor.getCachedResponse(armorRequest)
  if (cached) {
    return { ...(cached as { content: string }), model: finalModel, cached: true }
  }

  // Call OpenAI
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

  // Track + cache + log
  await armor.trackCost(finalModel, inputTokens, outputTokens, userId)
  armor.setCachedResponse(armorRequest, { content })

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

  return { content, model: finalModel, cost: `$${cost.toFixed(4)}` }
})

// --- GET /api/ai/stats ---
fastify.get('/api/ai/stats', async () => {
  const logs = armor.getLogs()
  const totalCost = logs.reduce((sum, l) => sum + l.cost, 0)
  const cachedCount = logs.filter(l => l.cached).length

  return {
    totalRequests: logs.length,
    totalCost: `$${totalCost.toFixed(4)}`,
    cacheHitRate: logs.length > 0 ? `${((cachedCount / logs.length) * 100).toFixed(1)}%` : '0%',
  }
})

// --- Start server ---
async function main() {
  await fastify.listen({ port: 3000, host: '0.0.0.0' })
}

main()
