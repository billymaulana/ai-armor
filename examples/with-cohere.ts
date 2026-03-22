/**
 * Example: ai-armor with Cohere SDK
 *
 * npm install ai-armor cohere-ai
 */

import { createArmor } from 'ai-armor'
import { CohereClientV2 } from 'cohere-ai'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 50, window: '1m' }],
  },
  budget: {
    daily: 25.0,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'command-r-plus': 'command-r',
      'command-r': 'command-light',
    },
  },
  cache: { enabled: true, strategy: 'exact', ttl: 3600, driver: 'memory' },
  routing: {
    aliases: {
      fast: 'command-light',
      balanced: 'command-r',
      best: 'command-r-plus',
    },
  },
  logging: { enabled: true, include: ['model', 'tokens', 'cost', 'latency'] },
})

const cohere = new CohereClientV2()

async function chat(userId: string, model: string, message: string) {
  const ctx = { userId }

  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed) {
    throw new Error('Rate limited')
  }

  const resolvedModel = armor.resolveModel(model)
  const budget = await armor.checkBudget(resolvedModel, ctx)
  const finalModel = budget.suggestedModel ?? resolvedModel

  const request = { model: finalModel, messages: [{ role: 'user' as const, content: message }] }
  const cached = armor.getCachedResponse(request)
  if (cached) {
    return cached as { content: string }
  }

  const start = Date.now()
  const response = await cohere.chat({
    model: finalModel,
    messages: [{ role: 'user', content: message }],
  })
  const latency = Date.now() - start

  const content = response.message?.content?.[0]?.text ?? ''
  const inputTokens = response.usage?.tokens?.inputTokens ?? 0
  const outputTokens = response.usage?.tokens?.outputTokens ?? 0

  await armor.trackCost(finalModel, inputTokens, outputTokens, userId)
  armor.setCachedResponse(request, { content })

  await armor.log({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    model: finalModel,
    provider: 'cohere',
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
  const result = await chat('user-1', 'balanced', 'Explain RAG in one sentence.')
  // eslint-disable-next-line no-console
  console.log(result.content)
}

main()
