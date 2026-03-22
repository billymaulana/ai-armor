/**
 * Example: Next.js App Router API route with ai-armor
 *
 * Production pattern for a Next.js 14+ App Router route handler
 * at app/api/chat/route.ts. Extracts userId from Authorization header,
 * applies rate limiting, budget checks, and proxies to OpenAI.
 *
 * npm install ai-armor openai
 */

import { createArmor } from 'ai-armor'
import OpenAI from 'openai'

// --- Shared armor instance (module-level singleton in Next.js) ---
const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [
      { key: 'user', limit: 30, window: '1m' },
      { key: 'ip', limit: 60, window: '1m' },
    ],
  },
  budget: {
    daily: 200.0,
    perUser: 15.0,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'gpt-4o': 'gpt-4o-mini',
      'claude-sonnet-4-20250514': 'claude-haiku-4-5-20251001',
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
    },
  },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency', 'cached', 'userId'],
  },
})

const openai = new OpenAI()

// --- Auth helper (replace with your JWT/session logic) ---
function extractUserId(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer '))
    return null
  // In production: verify JWT, decode payload, return sub claim
  // Simplified: treat token as user ID for demonstration
  return authHeader.slice(7)
}

// --- Next.js App Router: POST /api/chat ---
export async function POST(request: Request) {
  // 1. Extract user identity
  const authHeader = request.headers.get('authorization')
  const userId = extractUserId(authHeader)
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  // 2. Parse request body
  let body: { model?: string, message?: string }
  try {
    body = await request.json() as { model?: string, message?: string }
  }
  catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { model = 'fast', message } = body
  if (!message) {
    return Response.json({ error: 'Missing "message" field' }, { status: 400 })
  }

  const ctx = { userId, ip }

  // 3. Rate limit
  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed) {
    return Response.json(
      { error: 'Too many requests', retryAfter: new Date(rateLimit.resetAt).toISOString() },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) },
      },
    )
  }

  // 4. Resolve model alias + budget check
  const resolvedModel = armor.resolveModel(model)
  const budget = await armor.checkBudget(resolvedModel, ctx)
  if (!budget.allowed) {
    return Response.json(
      { error: 'Budget exceeded', action: budget.action },
      { status: 402 },
    )
  }
  const finalModel = budget.suggestedModel ?? resolvedModel

  // 5. Cache lookup
  const armorRequest = { model: finalModel, messages: [{ role: 'user' as const, content: message }] }
  const cached = armor.getCachedResponse(armorRequest)
  if (cached) {
    return Response.json({ ...(cached as { content: string }), model: finalModel, cached: true })
  }

  // 6. Call OpenAI
  const start = Date.now()
  try {
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

    // 7. Post-request: track cost, cache, log
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

    return Response.json({
      content,
      model: finalModel,
      cached: false,
      usage: { inputTokens, outputTokens, cost: `$${cost.toFixed(4)}` },
    })
  }
  catch (err) {
    const _latency = Date.now() - start
    return Response.json(
      { error: 'AI provider error', detail: err instanceof Error ? err.message : 'Unknown' },
      { status: 502 },
    )
  }
}

// --- Next.js App Router: GET /api/chat (usage stats) ---
export async function GET() {
  const logs = armor.getLogs()
  const totalCost = logs.reduce((sum, l) => sum + l.cost, 0)
  const cachedCount = logs.filter(l => l.cached).length

  return Response.json({
    totalRequests: logs.length,
    totalCost: `$${totalCost.toFixed(4)}`,
    cacheHitRate: logs.length > 0 ? `${((cachedCount / logs.length) * 100).toFixed(1)}%` : '0%',
  })
}
