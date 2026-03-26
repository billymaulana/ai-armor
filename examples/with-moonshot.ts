/**
 * Example: ai-armor with Moonshot AI (Kimi)
 *
 * Moonshot AI is OpenAI-compatible. Use the OpenAI SDK with a custom baseURL.
 *
 * npm install ai-armor openai
 */

import { createArmor } from 'ai-armor'
import OpenAI from 'openai'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 30, window: '1m' }],
  },
  budget: {
    daily: 20.0,
    onExceeded: 'downgrade-model',
    downgradeMap: { 'kimi-k2.5': 'kimi-k2' },
  },
  cache: { enabled: true, strategy: 'exact', ttl: 3600 },
  routing: {
    aliases: { fast: 'kimi-k2', best: 'kimi-k2.5' },
  },
  logging: { enabled: true, include: ['model', 'tokens', 'cost', 'latency'] },
})

// Moonshot uses OpenAI-compatible API
const client = new OpenAI({
  apiKey: 'your-moonshot-api-key',
  baseURL: 'https://api.moonshot.ai/v1', // or https://api.moonshot.cn/v1 for China
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
  const response = await client.chat.completions.create({
    model: finalModel,
    messages: [{ role: 'user', content: message }],
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
  const result = await chat('user-1', 'best', 'What is Kimi?')
  // eslint-disable-next-line no-console
  console.log(result.content)
}

main()
