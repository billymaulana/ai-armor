/**
 * Example: Streaming with Vercel AI SDK + ai-armor
 *
 * ai-armor's wrapStream hook automatically tracks tokens and cost
 * when the stream completes. No manual tracking needed.
 *
 * npm install ai-armor ai @ai-sdk/openai
 */

import process from 'node:process'
import { openai } from '@ai-sdk/openai'
import { streamText, wrapLanguageModel } from 'ai'
import { createArmor } from 'ai-armor'
import { aiArmorMiddleware } from 'ai-armor/ai-sdk'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 20, window: '1m' }],
  },
  budget: {
    daily: 50,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'gpt-4o': 'gpt-4o-mini',
    },
  },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency'],
    onRequest: (log) => {
      process.stdout.write(
        `[${log.model}] ${log.inputTokens}+${log.outputTokens} tokens | $${log.cost.toFixed(6)} | ${log.latency}ms\n`,
      )
    },
  },
})

async function main() {
  const protectedModel = wrapLanguageModel({
    model: openai('gpt-4o'),
    middleware: aiArmorMiddleware(armor, { userId: 'user-42' }),
  })

  // Stream text -- wrapStream handles cost tracking automatically
  const { textStream } = streamText({
    model: protectedModel,
    prompt: 'Write a short poem about production AI safety.',
  })

  process.stdout.write('--- Streaming response ---\n')
  for await (const chunk of textStream) {
    process.stdout.write(chunk)
  }
  process.stdout.write('\n--- Stream complete ---\n')

  // Logs are already populated by wrapStream
  const logs = armor.getLogs()
  process.stdout.write(`Total requests: ${logs.length}\n`)
  process.stdout.write(`Total cost: $${logs.reduce((s, l) => s + l.cost, 0).toFixed(6)}\n`)
}

main()
