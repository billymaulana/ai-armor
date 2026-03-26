/**
 * Example: ai-armor with Alibaba Qwen (通义千问)
 *
 * Qwen uses OpenAI-compatible API via DashScope.
 *
 * npm install ai-armor openai
 */

import { createArmor } from 'ai-armor'
import OpenAI from 'openai'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 40, window: '1m' }],
  },
  budget: {
    daily: 25.0,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'qwen2.5-max': 'qwen-plus',
      'qwen-plus': 'qwen2.5-72b-instruct',
    },
  },
  cache: { enabled: true, strategy: 'exact', ttl: 3600 },
  routing: {
    aliases: {
      fast: 'qwen2.5-72b-instruct',
      balanced: 'qwen-plus',
      best: 'qwen2.5-max',
    },
  },
  logging: { enabled: true, include: ['model', 'tokens', 'cost', 'latency'] },
})

const qwen = new OpenAI({
  apiKey: 'your-dashscope-api-key',
  baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', // International
  // baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1', // China
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
  const response = await qwen.chat.completions.create({
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
  const result = await chat('user-1', 'balanced', 'What is Alibaba Cloud?')
  // eslint-disable-next-line no-console
  console.log(result.content)
}

main()
