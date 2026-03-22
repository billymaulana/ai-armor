/**
 * Example: Streaming chat responses with ai-armor protection
 *
 * Demonstrates how to use ai-armor with OpenAI's streaming API (direct SDK).
 * Token counting happens after the stream completes, since usage
 * data is only available in the final chunk.
 *
 * For Vercel AI SDK streaming, use aiArmorMiddleware with streamText() --
 * the wrapStream hook handles cost tracking automatically.
 * See: examples/with-vercel-ai-sdk-streaming.ts
 *
 * npm install ai-armor openai
 */

import { createArmor } from 'ai-armor'
import OpenAI from 'openai'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [
      { key: 'user', limit: 20, window: '1m' },
    ],
  },
  budget: {
    daily: 50.0,
    perUser: 10.0,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'gpt-4o': 'gpt-4o-mini',
      'o1': 'o1-mini',
    },
  },
  cache: {
    enabled: false,
    strategy: 'exact',
    ttl: 0,
    driver: 'memory',
  },
  routing: {
    aliases: {
      fast: 'gpt-4o-mini',
      smart: 'gpt-4o',
    },
  },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency', 'cached', 'userId'],
  },
})

const openai = new OpenAI()

// --- Streaming chat with post-stream token tracking ---
async function streamChat(
  userId: string,
  model: string,
  message: string,
  onChunk: (text: string) => void,
): Promise<{ content: string, model: string, cost: number }> {
  const ctx = { userId }

  // 1. Rate limit before starting stream
  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed) {
    throw new Error(`Rate limited. Retry after ${new Date(rateLimit.resetAt).toISOString()}`)
  }

  // 2. Resolve model + budget check
  const resolvedModel = armor.resolveModel(model)
  const budget = await armor.checkBudget(resolvedModel, ctx)
  if (!budget.allowed) {
    throw new Error('Budget exceeded')
  }
  const finalModel = budget.suggestedModel ?? resolvedModel

  // 3. Start streaming
  const start = Date.now()
  const stream = await openai.chat.completions.create({
    model: finalModel,
    messages: [{ role: 'user', content: message }],
    max_tokens: 2048,
    stream: true,
    stream_options: { include_usage: true },
  })

  // 4. Collect chunks and emit to caller
  let fullContent = ''
  let inputTokens = 0
  let outputTokens = 0

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content
    if (delta) {
      fullContent += delta
      onChunk(delta)
    }

    // Usage data arrives in the final chunk when stream_options.include_usage is true
    if (chunk.usage) {
      inputTokens = chunk.usage.prompt_tokens
      outputTokens = chunk.usage.completion_tokens
    }
  }

  const latency = Date.now() - start

  // 5. Track cost AFTER stream completes (tokens now known)
  await armor.trackCost(finalModel, inputTokens, outputTokens, userId)

  const cost = armor.estimateCost(finalModel, inputTokens, outputTokens)

  // 6. Log the completed request
  await armor.log({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    model: finalModel,
    provider: 'openai',
    inputTokens,
    outputTokens,
    cost,
    latency,
    cached: false,
    fallback: finalModel !== resolvedModel,
    rateLimited: false,
    userId,
  })

  return { content: fullContent, model: finalModel, cost }
}

// --- Usage ---
async function main() {
  // eslint-disable-next-line no-console
  console.log('--- Streaming response ---')

  const result = await streamChat('user-42', 'smart', 'Explain event-driven architecture.', (chunk) => {
    // Write each chunk to stdout as it arrives
    // eslint-disable-next-line no-console
    console.log(chunk)
  })

  // eslint-disable-next-line no-console
  console.log(`\n--- Done: model=${result.model} cost=$${result.cost.toFixed(4)} ---`)
}

main()
