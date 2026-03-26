/**
 * Example: ai-armor with Fireworks AI (fast inference)
 *
 * Fireworks is OpenAI-compatible. Hosts open-source models with fast inference.
 *
 * npm install ai-armor openai
 */

import { createArmor } from 'ai-armor'
import OpenAI from 'openai'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 50, window: '1m' }],
  },
  budget: {
    daily: 15.0,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'accounts/fireworks/models/llama-v3p3-70b-instruct': 'accounts/fireworks/models/qwen3-8b',
    },
  },
  cache: { enabled: true, strategy: 'exact', ttl: 1800 },
  routing: {
    aliases: {
      fast: 'accounts/fireworks/models/qwen3-8b',
      smart: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    },
  },
  logging: { enabled: true, include: ['model', 'tokens', 'cost', 'latency'] },
})

const fireworks = new OpenAI({
  apiKey: 'your-fireworks-api-key',
  baseURL: 'https://api.fireworks.ai/inference/v1',
})

async function chat(userId: string, model: string, message: string) {
  const ctx = { userId }
  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed)
    throw new Error('Rate limited')

  const resolvedModel = armor.resolveModel(model)
  const budget = await armor.checkBudget(resolvedModel, ctx)
  const finalModel = budget.suggestedModel ?? resolvedModel

  const request = { model: finalModel, messages: [{ role: 'user' as const, content: message }] }
  const cached = armor.getCachedResponse(request)
  if (cached)
    return cached as { content: string }

  const start = Date.now()
  const response = await fireworks.chat.completions.create({
    model: finalModel,
    messages: [{ role: 'user', content: message }],
    max_tokens: 1024,
  })
  const _latency = Date.now() - start
  const content = response.choices[0]?.message?.content ?? ''
  const inputTokens = response.usage?.prompt_tokens ?? 0
  const outputTokens = response.usage?.completion_tokens ?? 0

  await armor.trackCost(finalModel, inputTokens, outputTokens, userId)
  armor.setCachedResponse(request, { content })

  return { content }
}

async function main() {
  const result = await chat('user-1', 'smart', 'What makes Fireworks AI fast?')
  // eslint-disable-next-line no-console
  console.log(result.content)
}

main()
