# Vercel AI SDK Integration

ai-armor provides a first-class middleware adapter for the [Vercel AI SDK](https://sdk.vercel.ai/). Wrap any language model with ai-armor protection -- rate limiting, caching, cost tracking, and logging are applied automatically.

## Installation

```bash
npm install ai-armor ai @ai-sdk/openai
```

## Quick Start

```ts
import { openai } from '@ai-sdk/openai'
import { generateText, wrapLanguageModel } from 'ai'
import { createArmor } from 'ai-armor'
import { aiArmorMiddleware } from 'ai-armor/ai-sdk'

// 1. Create armor instance
const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 30, window: '1m' }],
  },
  budget: {
    daily: 50,
    onExceeded: 'downgrade-model',
    downgradeMap: { 'gpt-4o': 'gpt-4o-mini' },
  },
  cache: {
    enabled: true,
    strategy: 'exact',
    ttl: 3600,
    driver: 'memory',
  },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency', 'cached', 'userId'],
  },
})

// 2. Wrap any AI SDK model
const protectedModel = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: aiArmorMiddleware(armor, { userId: 'user-123' }),
})

// 3. Use as normal -- all protections applied automatically
const { text } = await generateText({
  model: protectedModel,
  prompt: 'Explain TypeScript generics in one sentence.',
})

// eslint-disable-next-line no-console
console.log(text)
```

## How aiArmorMiddleware Works

The middleware hooks into three phases of the AI SDK request lifecycle:

### transformParams

Before the request is sent to the AI provider:

1. **Resolve model aliases** -- Maps `'fast'` to `'gpt-4o-mini'`, etc.
2. **Check safety** -- Blocks prompt injection, PII, and custom patterns
3. **Check rate limit** -- Throws if the user has exceeded their limit
4. **Check budget** -- Throws if blocked, or suggests a cheaper model
5. **Prepare cache** -- Stores cache lookup result for wrapGenerate

### wrapGenerate

After the AI provider responds (non-streaming):

1. **Return cached** -- If a cache hit was found, returns it without calling the provider
2. **Track cost** -- Records token usage and calculated cost
3. **Cache response** -- Stores successful responses for future cache hits
4. **Log request** -- Records the full `ArmorLog` entry

### wrapStream

For streaming responses (`streamText`):

1. **Track cost on stream completion** -- Captures token usage from `step-finish` / `finish` stream events
2. **Log request** -- Records the full `ArmorLog` entry after the stream ends

All rate limiting, safety, and budget checks happen in `transformParams`, so they apply to both `generateText` and `streamText` calls.

```
Request Flow:

  generateText() --> transformParams --> [cache hit?] --> return cached
                          |
                          | (cache miss)
                          v
                    wrapGenerate --> AI Provider --> trackCost
                          |                          --> cache response
                          v                          --> log request
                    return result

  streamText()  --> transformParams --> wrapStream --> AI Provider
                                            |
                                            v (stream chunks pass through)
                                       [step-finish] --> trackCost + log
```

## Passing Context

The second argument to `aiArmorMiddleware` is an `ArmorContext` object. Use it to identify users for rate limiting and per-user budgets:

```ts
// Static context (same user for all calls)
const middleware = aiArmorMiddleware(armor, { userId: 'user-123' })

// Dynamic context (per-request in a server)
app.post('/api/chat', async (req, res) => {
  const model = wrapLanguageModel({
    model: openai('gpt-4o'),
    middleware: aiArmorMiddleware(armor, {
      userId: req.headers['x-user-id'] as string,
      ip: req.ip,
      apiKey: req.headers['x-api-key'] as string,
    }),
  })

  const { text } = await generateText({
    model,
    prompt: req.body.prompt,
  })

  res.json({ text })
})
```

## Error Handling

The middleware throws errors for rate limit and budget violations. Catch them in your application code:

```ts
import { generateText, wrapLanguageModel } from 'ai'

const protectedModel = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: aiArmorMiddleware(armor, { userId: 'user-123' }),
})

try {
  const { text } = await generateText({
    model: protectedModel,
    prompt: 'Hello',
  })
  // eslint-disable-next-line no-console
  console.log(text)
}
catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('[ai-armor] Rate limited')) {
      // Extract reset time from the error message
      // eslint-disable-next-line no-console
      console.log('Rate limited. Try again later.')
    }
    else if (error.message.includes('[ai-armor] Budget exceeded')) {
      // eslint-disable-next-line no-console
      console.log('Budget exceeded. Request blocked.')
    }
    else {
      // AI provider error
      console.error('AI error:', error.message)
    }
  }
}
```

::: info Error Messages
- Rate limit: `[ai-armor] Rate limited. Resets at 2026-03-22T10:30:00.000Z`
- Budget block: `[ai-armor] Budget exceeded. Action: block`
:::

## Automatic Features

When using the middleware, these features are handled without any manual code:

### Rate Limiting

Checked before every request. If the user exceeds the limit, the middleware throws an error.

### Model Resolution

Aliases in the `routing.aliases` config are resolved automatically. If you pass `openai('fast')` and `fast` is aliased to `gpt-4o-mini`, the request goes to `gpt-4o-mini`.

### Budget Checking

If the budget is exceeded:
- `onExceeded: 'block'` -- throws an error
- `onExceeded: 'warn'` -- proceeds, fires `onWarned` callback
- `onExceeded: 'downgrade-model'` -- uses the `suggestedModel` from `downgradeMap`

### Caching

Identical requests (same model, messages, temperature, tools) return cached responses. Cache hits are logged with `cached: true` and `cost: 0`.

### Cost Tracking

After every successful response, `armor.trackCost()` is called with the actual token counts from the response usage metadata.

### Logging

Every request is logged with a full `ArmorLog` entry, including failed requests (with the error stored in the `blocked` field).

## Full Example

```ts
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
    daily: 50,
    perUser: 10,
    onExceeded: 'downgrade-model',
    downgradeMap: { 'gpt-4o': 'gpt-4o-mini' },
  },
  cache: {
    enabled: true,
    strategy: 'exact',
    ttl: 3600,
    driver: 'memory',
  },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency', 'cached', 'userId'],
  },
})

async function main() {
  const protectedModel = wrapLanguageModel({
    model: openai('gpt-4o'),
    middleware: aiArmorMiddleware(armor, { userId: 'user-789' }),
  })

  // First call: hits the API
  const { text } = await generateText({
    model: protectedModel,
    prompt: 'Explain REST vs GraphQL in 2 sentences.',
  })
  // eslint-disable-next-line no-console
  console.log(text)

  // Second identical call: returns from cache
  const { text: cached } = await generateText({
    model: protectedModel,
    prompt: 'Explain REST vs GraphQL in 2 sentences.',
  })
  // eslint-disable-next-line no-console
  console.log('(cached)', cached)

  // View logs
  const logs = armor.getLogs()
  // eslint-disable-next-line no-console
  console.log(`Requests: ${logs.length}`)
  // eslint-disable-next-line no-console
  console.log(`Total cost: $${logs.reduce((s, l) => s + l.cost, 0).toFixed(4)}`)
  // eslint-disable-next-line no-console
  console.log(`Cache hits: ${logs.filter(l => l.cached).length}`)
}

main()
```

## Streaming

Streaming responses are fully supported via `wrapStream`. Token usage and cost are tracked automatically when the stream completes:

```ts
import { openai } from '@ai-sdk/openai'
import { streamText, wrapLanguageModel } from 'ai'
import { createArmor } from 'ai-armor'
import { aiArmorMiddleware } from 'ai-armor/ai-sdk'

const armor = createArmor({
  budget: { daily: 50, onExceeded: 'warn' },
  logging: { enabled: true, include: ['model', 'tokens', 'cost', 'latency'] },
})

const protectedModel = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: aiArmorMiddleware(armor, { userId: 'user-123' }),
})

const { textStream } = streamText({
  model: protectedModel,
  prompt: 'Write a haiku about TypeScript.',
})

for await (const chunk of textStream) {
  process.stdout.write(chunk)
}
// Cost and tokens are tracked automatically when the stream ends
```

## Using with Other Providers

The middleware works with any AI SDK provider:

```ts
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { mistral } from '@ai-sdk/mistral'

// Anthropic
const protectedClaude = wrapLanguageModel({
  model: anthropic('claude-sonnet-4-20250514'),
  middleware: aiArmorMiddleware(armor, { userId: 'user-1' }),
})

// Google
const protectedGemini = wrapLanguageModel({
  model: google('gemini-2.5-pro'),
  middleware: aiArmorMiddleware(armor, { userId: 'user-1' }),
})

// Mistral
const protectedMistral = wrapLanguageModel({
  model: mistral('mistral-large-latest'),
  middleware: aiArmorMiddleware(armor, { userId: 'user-1' }),
})
```

## Related

- [Getting Started](/guide/getting-started) -- Installation and basic setup
- [Rate Limiting](/guide/rate-limiting) -- Rate limit configuration details
- [Cost Tracking](/guide/cost-tracking) -- Budget and cost configuration
- [Caching](/guide/caching) -- Cache configuration details
- [Nuxt Integration](/integrations/nuxt) -- Nuxt module setup
- [API Reference: createArmor](/api/create-armor) -- Full configuration reference
