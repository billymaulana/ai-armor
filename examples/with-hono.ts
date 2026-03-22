/**
 * Example: Hono framework with ai-armor middleware
 *
 * Production pattern for Cloudflare Workers / Bun / Node.js using Hono.
 * Creates a middleware that enforces rate limiting and budget checks
 * before AI requests reach the handler.
 *
 * npm install ai-armor hono openai
 */

import type { ArmorInstance } from 'ai-armor'
import { createArmor } from 'ai-armor'
import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'
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
    daily: 100.0,
    perUser: 10.0,
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
    driver: 'memory',
    maxSize: 3000,
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

// --- Hono ai-armor middleware factory ---
function armorMiddleware(armorInstance: ArmorInstance) {
  return async (c: Parameters<Parameters<InstanceType<typeof Hono>['use']>[0]>[0], next: () => Promise<void>) => {
    const userId = c.req.header('x-user-id') ?? 'anonymous'
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const ctx = { userId, ip }

    // Rate limit check
    const rateLimit = await armorInstance.checkRateLimit(ctx)
    if (!rateLimit.allowed) {
      return c.json(
        { error: 'Too many requests', retryAfter: new Date(rateLimit.resetAt).toISOString() },
        429,
      )
    }

    // Store armor context for downstream handlers
    c.set('armorCtx', ctx)
    c.set('armorUserId', userId)

    await next()
  }
}

// --- Hono app ---
interface Variables {
  armorCtx: { userId: string, ip: string }
  armorUserId: string
}

const app = new Hono<{ Variables: Variables }>()

// Global middleware: bearer auth (simplified)
app.use('/api/*', bearerAuth({ token: 'my-secret-token' }))

// AI routes: apply armor middleware
app.use('/api/ai/*', armorMiddleware(armor))

// POST /api/ai/chat — protected AI chat endpoint
app.post('/api/ai/chat', async (c) => {
  const userId = c.get('armorUserId')
  const ctx = c.get('armorCtx')
  const body = await c.req.json<{ model?: string, message: string }>()

  const { model = 'fast', message } = body
  if (!message) {
    return c.json({ error: 'Missing "message" field' }, 400)
  }

  // Resolve + budget
  const resolvedModel = armor.resolveModel(model)
  const budget = await armor.checkBudget(resolvedModel, ctx)
  if (!budget.allowed) {
    return c.json({ error: 'Budget exceeded' }, 402)
  }
  const finalModel = budget.suggestedModel ?? resolvedModel

  // Cache
  const request = { model: finalModel, messages: [{ role: 'user' as const, content: message }] }
  const cached = armor.getCachedResponse(request)
  if (cached) {
    return c.json({ ...(cached as { content: string }), model: finalModel, cached: true })
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

  return c.json({ content, model: finalModel, cost: `$${cost.toFixed(4)}` })
})

// GET /api/ai/stats — usage statistics
app.get('/api/ai/stats', (c) => {
  const logs = armor.getLogs()
  const totalCost = logs.reduce((sum, l) => sum + l.cost, 0)
  const cachedCount = logs.filter(l => l.cached).length

  return c.json({
    totalRequests: logs.length,
    totalCost: `$${totalCost.toFixed(4)}`,
    cacheHitRate: logs.length > 0 ? `${((cachedCount / logs.length) * 100).toFixed(1)}%` : '0%',
  })
})

// --- Export for Cloudflare Workers / Bun / Node.js ---
export default app
