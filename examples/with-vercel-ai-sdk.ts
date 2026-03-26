/**
 * Example: ai-armor with Vercel AI SDK
 *
 * Uses the built-in AI SDK middleware adapter for seamless integration.
 * ai-armor handles rate limiting, caching, cost tracking, and logging
 * transparently via wrapLanguageModel().
 *
 * npm install ai-armor ai @ai-sdk/openai @ai-sdk/anthropic
 */

import { openai } from '@ai-sdk/openai'
import { generateText, wrapLanguageModel } from 'ai'
import { createArmor } from 'ai-armor'
import { aiArmorMiddleware } from 'ai-armor/ai-sdk'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 30, window: '1m' }],
  },
  budget: {
    daily: 50.0,
    perUser: 10.0,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'gpt-4o': 'gpt-4o-mini',
    },
  },
  cache: {
    enabled: true,
    strategy: 'exact',
    ttl: 3600,
  },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency', 'cached', 'userId'],
  },
})

// Wrap any AI SDK model with ai-armor protection
const protectedModel = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: aiArmorMiddleware(armor, { userId: 'user-789' }),
})

async function main() {
  // All ai-armor features are applied automatically:
  // - Rate limiting checked before each call
  // - Budget checked and model downgraded if needed
  // - Response cached for identical requests
  // - Cost tracked after each call
  // - Full request logged
  const { text } = await generateText({
    model: protectedModel,
    prompt: 'Explain the difference between REST and GraphQL in 2 sentences.',
  })

  // eslint-disable-next-line no-console
  console.log(text)

  // Check logs
  const logs = armor.getLogs()
  // eslint-disable-next-line no-console
  console.log(`\nLogs: ${logs.length} entries, total cost: $${logs.reduce((s, l) => s + l.cost, 0).toFixed(4)}`)
}

main()
