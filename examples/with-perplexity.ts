/**
 * Example: ai-armor with Perplexity AI (search-augmented generation)
 *
 * Perplexity is OpenAI-compatible. Best for queries that need real-time web info.
 *
 * npm install ai-armor openai
 */

import { createArmor } from 'ai-armor'
import OpenAI from 'openai'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 20, window: '1m' }],
  },
  budget: {
    daily: 30.0,
    onExceeded: 'downgrade-model',
    downgradeMap: { 'sonar-pro': 'sonar' },
  },
  cache: { enabled: true, strategy: 'exact', ttl: 300, driver: 'memory' }, // Short TTL for search results
  routing: {
    aliases: { fast: 'sonar', research: 'sonar-pro' },
  },
  logging: { enabled: true, include: ['model', 'tokens', 'cost', 'latency'] },
})

const perplexity = new OpenAI({
  apiKey: 'your-perplexity-api-key',
  baseURL: 'https://api.perplexity.ai',
})

async function search(userId: string, model: string, query: string) {
  const ctx = { userId }
  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed)
    throw new Error('Rate limited')

  const resolvedModel = armor.resolveModel(model)
  const budget = await armor.checkBudget(resolvedModel, ctx)
  const finalModel = budget.suggestedModel ?? resolvedModel

  const request = { model: finalModel, messages: [{ role: 'user' as const, content: query }] }
  const cached = armor.getCachedResponse(request)
  if (cached)
    return cached as { content: string }

  const start = Date.now()
  const response = await perplexity.chat.completions.create({
    model: finalModel,
    messages: [{ role: 'user', content: query }],
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
  const result = await search('user-1', 'research', 'Latest AI developments in March 2026')
  // eslint-disable-next-line no-console
  console.log(result.content)
}

main()
