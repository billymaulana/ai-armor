/**
 * Example: ai-armor with Google Gemini (via @google/generative-ai)
 *
 * npm install ai-armor @google/generative-ai
 */

import process from 'node:process'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createArmor } from 'ai-armor'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 60, window: '1m' }],
  },
  budget: {
    daily: 30.0,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'gemini-2.5-pro': 'gemini-2.5-flash',
      'gemini-2.5-flash': 'gemini-2.0-flash',
    },
  },
  cache: {
    enabled: true,
    strategy: 'exact',
    ttl: 3600,
  },
  routing: {
    aliases: {
      fast: 'gemini-2.0-flash',
      balanced: 'gemini-2.5-flash',
      best: 'gemini-2.5-pro',
    },
  },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency'],
  },
})

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)

async function chat(userId: string, model: string, message: string) {
  const ctx = { userId }

  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed) {
    throw new Error('Rate limited')
  }

  const resolvedModel = armor.resolveModel(model)
  const budget = await armor.checkBudget(resolvedModel, ctx)
  if (!budget.allowed) {
    throw new Error('Budget exceeded')
  }
  const finalModel = budget.suggestedModel ?? resolvedModel

  // Cache check
  const request = { model: finalModel, messages: [{ role: 'user', content: message }] }
  const cached = armor.getCachedResponse(request)
  if (cached) {
    return cached as { content: string }
  }

  // Call Gemini
  const start = Date.now()
  const geminiModel = genAI.getGenerativeModel({ model: finalModel })
  const result = await geminiModel.generateContent(message)
  const latency = Date.now() - start

  const content = result.response.text()
  const usage = result.response.usageMetadata
  const inputTokens = usage?.promptTokenCount ?? 0
  const outputTokens = usage?.candidatesTokenCount ?? 0

  // Track + cache + log
  await armor.trackCost(finalModel, inputTokens, outputTokens, userId)
  armor.setCachedResponse(request, { content })

  await armor.log({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    model: finalModel,
    provider: 'google',
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
  const result = await chat('user-001', 'balanced', 'What is Nuxt.js?')
  // eslint-disable-next-line no-console
  console.log(result.content)
}

main()
