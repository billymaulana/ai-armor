/**
 * Example: ai-armor with Together AI (open-source model hosting)
 *
 * Together AI is OpenAI-compatible. Hosts 200+ open-source models
 * including Llama, Qwen, Mixtral, and more.
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
    daily: 20.0,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'meta-llama/Llama-3.3-70B-Instruct-Turbo': 'meta-llama/Llama-4-Scout-17B-16E-Instruct',
      'Qwen/Qwen2.5-72B-Instruct-Turbo': 'meta-llama/Llama-4-Scout-17B-16E-Instruct',
    },
  },
  cache: { enabled: true, strategy: 'exact', ttl: 3600, driver: 'memory' },
  routing: {
    aliases: {
      llama70b: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      scout: 'meta-llama/Llama-4-Scout-17B-16E-Instruct',
      qwen72b: 'Qwen/Qwen2.5-72B-Instruct-Turbo',
    },
  },
  logging: { enabled: true, include: ['model', 'tokens', 'cost', 'latency'] },
})

const together = new OpenAI({
  apiKey: 'your-together-api-key',
  baseURL: 'https://api.together.xyz/v1',
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
  const response = await together.chat.completions.create({
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
  // Use Llama 3.3 70B via Together AI
  const result = await chat('user-1', 'llama70b', 'What are the benefits of open-source AI models?')
  // eslint-disable-next-line no-console
  console.log(result.content)
}

main()
