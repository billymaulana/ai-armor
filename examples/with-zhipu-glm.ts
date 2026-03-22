/**
 * Example: ai-armor with Zhipu AI (Z.AI / GLM models)
 *
 * Zhipu AI is OpenAI-compatible. Use the OpenAI SDK with a custom baseURL.
 * GLM-4.7-Flash and GLM-4.5-Flash are FREE to use.
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
      'glm-5': 'glm-4.7',
    },
  },
  cache: { enabled: true, strategy: 'exact', ttl: 3600, driver: 'memory' },
  routing: {
    aliases: {
      fast: 'glm-4.7',
      best: 'glm-5',
    },
  },
  logging: { enabled: true, include: ['model', 'tokens', 'cost', 'latency'] },
})

const client = new OpenAI({
  apiKey: 'your-zhipu-api-key',
  baseURL: 'https://api.z.ai/api/paas/v4/', // International
  // baseURL: 'https://open.bigmodel.cn/api/paas/v4/', // China mainland
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
  const result = await chat('user-1', 'fast', 'Explain GLM architecture briefly.')
  // eslint-disable-next-line no-console
  console.log(result.content)
}

main()
