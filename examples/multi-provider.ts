/**
 * Example: ai-armor with multiple AI providers
 *
 * Single armor instance protects all providers with unified
 * rate limiting, budget tracking, and cost monitoring.
 *
 * npm install ai-armor openai @anthropic-ai/sdk @google/generative-ai
 */

import { createArmor } from 'ai-armor'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [
      { key: 'user', limit: 60, window: '1m' },
    ],
    // Custom key resolver: rate limit by API key, not user
    keyResolver: (ctx, ruleKey) => {
      if (ruleKey === 'user')
        return ctx.apiKey ?? ctx.userId ?? 'anon'
      return ctx[ruleKey] as string ?? 'unknown'
    },
  },
  budget: {
    daily: 200.0,
    monthly: 2000.0,
    perUser: 50.0,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      // OpenAI
      'gpt-4o': 'gpt-4o-mini',
      'o1': 'o1-mini',
      // Anthropic
      'claude-opus-4-20250514': 'claude-sonnet-4-20250514',
      'claude-sonnet-4-20250514': 'claude-haiku-4-5-20251001',
      // Google
      'gemini-2.5-pro': 'gemini-2.5-flash',
    },
    onWarned: (_ctx, budget) => {
      console.warn(`[ai-armor] Budget warning: daily=$${budget.daily.toFixed(2)}, monthly=$${budget.monthly.toFixed(2)}`)
    },
  },
  cache: {
    enabled: true,
    strategy: 'exact',
    ttl: 1800,
    maxSize: 5000,
  },
  routing: {
    aliases: {
      // Tier-based aliases (provider-agnostic)
      fast: 'gpt-4o-mini',
      balanced: 'claude-sonnet-4-20250514',
      best: 'claude-opus-4-20250514',
      reasoning: 'o1',
      cheap: 'gemini-2.0-flash',
      // Provider-specific aliases
      openai: 'gpt-4o',
      claude: 'claude-sonnet-4-20250514',
      gemini: 'gemini-2.5-pro',
    },
  },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency', 'cached', 'userId'],
    maxEntries: 10000,
    onRequest: async (log) => {
      // Send to your analytics service
      if (log.cost > 0.10) {
        console.warn(`[ai-armor] Expensive request: $${log.cost.toFixed(4)} on ${log.model}`)
      }
    },
  },
})

// --- Usage: provider-agnostic chat function ---
async function protectedChat(
  userId: string,
  model: string,
  message: string,
  callProvider: (model: string, message: string) => Promise<{ content: string, inputTokens: number, outputTokens: number }>,
) {
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

  // Cache
  const request = { model: finalModel, messages: [{ role: 'user', content: message }] }
  const cached = armor.getCachedResponse(request) as { content: string } | undefined
  if (cached) {
    return { content: cached.content, cached: true, model: finalModel }
  }

  // Call provider
  const start = Date.now()
  const result = await callProvider(finalModel, message)
  const latency = Date.now() - start

  // Track + cache + log
  await armor.trackCost(finalModel, result.inputTokens, result.outputTokens, userId)
  armor.setCachedResponse(request, { content: result.content })

  const cost = armor.estimateCost(finalModel, result.inputTokens, result.outputTokens)
  await armor.log({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    model: finalModel,
    provider: finalModel.startsWith('gpt') || finalModel.startsWith('o1')
      ? 'openai'
      : finalModel.startsWith('claude')
        ? 'anthropic'
        : finalModel.startsWith('gemini')
          ? 'google'
          : 'unknown',
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    cost,
    latency,
    cached: false,
    fallback: false,
    rateLimited: false,
    userId,
  })

  return { content: result.content, cached: false, model: finalModel, cost }
}

// --- Dashboard ---
function dashboard() {
  const logs = armor.getLogs()
  const byProvider: Record<string, { count: number, cost: number }> = {}

  for (const log of logs) {
    if (!byProvider[log.provider]) {
      byProvider[log.provider] = { count: 0, cost: 0 }
    }
    byProvider[log.provider]!.count++
    byProvider[log.provider]!.cost += log.cost
  }

  return {
    totalRequests: logs.length,
    totalCost: logs.reduce((s, l) => s + l.cost, 0),
    cacheHitRate: logs.length > 0
      ? logs.filter(l => l.cached).length / logs.length
      : 0,
    byProvider,
  }
}

// --- Example usage ---
async function main() {
  // Mock provider calls (replace with real SDK calls)
  const mockProvider = async (model: string, _message: string) => ({
    content: `Response from ${model}`,
    inputTokens: 100,
    outputTokens: 50,
  })

  await protectedChat('user-1', 'balanced', 'Hello!', mockProvider)
  await protectedChat('user-1', 'fast', 'Quick question', mockProvider)
  await protectedChat('user-2', 'best', 'Complex task', mockProvider)

  // eslint-disable-next-line no-console
  console.log(dashboard())
}

main()
