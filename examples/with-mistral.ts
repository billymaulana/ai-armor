/**
 * Example: ai-armor with Mistral AI SDK
 *
 * npm install ai-armor @mistralai/mistralai
 */

import { Mistral } from '@mistralai/mistralai'
import { createArmor } from 'ai-armor'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 40, window: '1m' }],
  },
  budget: {
    daily: 30.0,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'mistral-large-latest': 'mistral-small-latest',
      'codestral-latest': 'mistral-small-latest',
    },
  },
  cache: { enabled: true, strategy: 'exact', ttl: 3600 },
  routing: {
    aliases: {
      fast: 'mistral-small-latest',
      smart: 'mistral-large-latest',
      code: 'codestral-latest',
    },
  },
  logging: { enabled: true, include: ['model', 'tokens', 'cost', 'latency', 'cached'] },
})

const mistral = new Mistral()

async function chat(userId: string, model: string, message: string) {
  const ctx = { userId }

  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed) {
    throw new Error('Rate limited')
  }

  const resolvedModel = armor.resolveModel(model)
  const budget = await armor.checkBudget(resolvedModel, ctx)
  const finalModel = budget.suggestedModel ?? resolvedModel

  // Cache
  const request = { model: finalModel, messages: [{ role: 'user' as const, content: message }] }
  const cached = armor.getCachedResponse(request)
  if (cached) {
    return cached as { content: string }
  }

  const start = Date.now()
  const response = await mistral.chat.complete({
    model: finalModel,
    messages: [{ role: 'user', content: message }],
  })
  const latency = Date.now() - start

  const content = response.choices?.[0]?.message?.content ?? ''
  const inputTokens = response.usage?.promptTokens ?? 0
  const outputTokens = response.usage?.completionTokens ?? 0

  await armor.trackCost(finalModel, inputTokens, outputTokens, userId)
  armor.setCachedResponse(request, { content })

  await armor.log({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    model: finalModel,
    provider: 'mistral',
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
  const result = await chat('user-1', 'smart', 'What is TypeScript?')
  // eslint-disable-next-line no-console
  console.log(result.content)
}

main()
