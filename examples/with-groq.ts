/**
 * Example: ai-armor with Groq (ultra-fast LPU inference)
 *
 * Groq is OpenAI-compatible. Best for low-latency open-source model inference.
 * Supports Llama, Mixtral, Gemma and more.
 *
 * npm install ai-armor openai
 */

import { createArmor } from 'ai-armor'
import OpenAI from 'openai'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 60, window: '1m' }],
  },
  budget: {
    daily: 10.0,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'llama3-70b-8192': 'gemma2-9b-it',
      'mixtral-8x7b-32768': 'gemma2-9b-it',
    },
  },
  cache: { enabled: true, strategy: 'exact', ttl: 1800, driver: 'memory' },
  routing: {
    aliases: {
      fast: 'gemma2-9b-it',
      balanced: 'mixtral-8x7b-32768',
      smart: 'llama3-70b-8192',
      scout: 'llama-4-scout',
    },
  },
  logging: { enabled: true, include: ['model', 'tokens', 'cost', 'latency'] },
})

const groq = new OpenAI({
  apiKey: 'your-groq-api-key',
  baseURL: 'https://api.groq.com/openai/v1',
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
  const response = await groq.chat.completions.create({
    model: finalModel,
    messages: [{ role: 'user', content: message }],
    max_tokens: 1024,
  })
  const latency = Date.now() - start
  const content = response.choices[0]?.message?.content ?? ''
  const inputTokens = response.usage?.prompt_tokens ?? 0
  const outputTokens = response.usage?.completion_tokens ?? 0

  await armor.trackCost(finalModel, inputTokens, outputTokens, userId)
  armor.setCachedResponse(request, { content })

  // eslint-disable-next-line no-console
  console.log(`[Groq] ${finalModel}: ${latency}ms (typically <500ms with LPU)`)
  return { content }
}

async function main() {
  const result = await chat('user-1', 'smart', 'Explain LPU vs GPU for inference.')
  // eslint-disable-next-line no-console
  console.log(result.content)
}

main()
