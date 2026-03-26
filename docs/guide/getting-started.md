# Getting Started

ai-armor is a production AI toolkit for TypeScript. It provides rate limiting, cost tracking, budgets, caching, model routing, safety guardrails, and logging -- all in one package.

## Installation

::: code-group

```bash [npm]
npm install ai-armor
```

```bash [pnpm]
pnpm add ai-armor
```

```bash [yarn]
yarn add ai-armor
```

:::

**Optional peer dependencies** (install only what you need):

```bash
# For Vercel AI SDK middleware
npm install ai @ai-sdk/openai

# For Nuxt module
npm install @ai-armor/nuxt
```

## Quick Start

There are three ways to use ai-armor depending on your setup.

### Pattern 1: Direct SDK Usage

Use ai-armor's methods directly alongside any AI provider SDK. This gives you full control over the request lifecycle.

```ts
import { createArmor } from 'ai-armor'
import OpenAI from 'openai'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [
      { key: 'user', limit: 30, window: '1m' },
    ],
  },
  budget: {
    daily: 50,
    monthly: 500,
    perUser: 10,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'gpt-4o': 'gpt-4o-mini',
    },
  },
  cache: {
    enabled: true,
    strategy: 'exact',
    ttl: 3600,

    maxSize: 1000,
  },
  routing: {
    aliases: {
      fast: 'gpt-4o-mini',
      balanced: 'gpt-4o',
    },
  },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency', 'cached'],
  },
})

const openai = new OpenAI()

async function chat(userId: string, model: string, message: string) {
  const ctx = { userId }

  // 1. Check rate limit
  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed) {
    throw new Error(`Rate limited. Retry after ${new Date(rateLimit.resetAt).toISOString()}`)
  }

  // 2. Resolve alias + check budget
  const resolvedModel = armor.resolveModel(model)
  const budget = await armor.checkBudget(resolvedModel, ctx)
  if (!budget.allowed) {
    throw new Error('Budget exceeded')
  }
  const finalModel = budget.suggestedModel ?? resolvedModel

  // 3. Check cache
  const request = { model: finalModel, messages: [{ role: 'user' as const, content: message }] }
  const cached = await armor.getCachedResponse(request)
  if (cached)
    return cached

  // 4. Call OpenAI
  const start = Date.now()
  const response = await openai.chat.completions.create({
    model: finalModel,
    messages: [{ role: 'user', content: message }],
  })

  // 5. Track cost + cache + log
  const usage = response.usage!
  await armor.trackCost(finalModel, usage.prompt_tokens, usage.completion_tokens, userId)
  await armor.setCachedResponse(request, response)

  await armor.log({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    model: finalModel,
    provider: 'openai',
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    cost: armor.estimateCost(finalModel, usage.prompt_tokens, usage.completion_tokens),
    latency: Date.now() - start,
    cached: false,
    fallback: false,
    rateLimited: false,
    userId,
  })

  return response.choices[0]?.message?.content ?? ''
}
```

### Pattern 2: AI SDK Middleware

If you use the [Vercel AI SDK](https://sdk.vercel.ai/), wrap any model with ai-armor middleware for automatic protection:

```ts
import { openai } from '@ai-sdk/openai'
import { generateText, wrapLanguageModel } from 'ai'
import { createArmor } from 'ai-armor'
import { aiArmorMiddleware } from 'ai-armor/ai-sdk' // [!code highlight]

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
  cache: { enabled: true, strategy: 'exact', ttl: 3600 },
  logging: { enabled: true, include: ['model', 'tokens', 'cost', 'latency', 'cached'] },
})

const protectedModel = wrapLanguageModel({ // [!code highlight]
  model: openai('gpt-4o'), // [!code highlight]
  middleware: aiArmorMiddleware(armor, { userId: 'user-123' }), // [!code highlight]
}) // [!code highlight]

// All protections applied automatically
const { text } = await generateText({
  model: protectedModel,
  prompt: 'Explain TypeScript generics.',
})
```

The middleware handles rate limiting, budget checks, caching, cost tracking, and logging automatically. See the [AI SDK integration guide](/integrations/ai-sdk) for full details.

### Pattern 3: HTTP Middleware

For REST API servers (Express, Hono, Fastify), use the HTTP middleware to protect AI proxy endpoints:

```ts
import { createArmor } from 'ai-armor'
import { createArmorHandler } from 'ai-armor/http' // [!code highlight]
import express from 'express'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [
      { key: 'user', limit: 30, window: '1m' },
      { key: 'ip', limit: 100, window: '1m' },
    ],
  },
  budget: { daily: 200, onExceeded: 'block' },
  cache: { enabled: true, strategy: 'exact', ttl: 1800 },
  routing: {
    aliases: { fast: 'gpt-4o-mini', balanced: 'gpt-4o' },
  },
})

const app = express()
app.use(express.json())
app.use('/api/ai/*', createArmorHandler(armor)) // [!code highlight]

app.post('/api/ai/chat', (req, res) => {
  // Rate limit, budget, cache already checked
  // req.body.model is resolved (aliases expanded)
  res.json({ model: req.body.model })
})

app.listen(3000)
```

The HTTP handler automatically:
- Extracts `userId`, `ip`, and `apiKey` from request headers
- Returns 429 with `Retry-After` header on rate limit
- Returns 402 on budget exceeded
- Returns cached response with 200 on cache hit
- Resolves model aliases in the request body

## Minimal Configuration

Every feature is opt-in. Start with just what you need:

```ts
// Just rate limiting
const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 30, window: '1m' }],
  },
})

// Just cost tracking
const armor = createArmor({
  budget: {
    daily: 50,
    onExceeded: 'warn',
  },
})

// Just caching
const armor = createArmor({
  cache: {
    enabled: true,
    strategy: 'exact',
    ttl: 3600,

  },
})
```

## What's Next

Dive deeper into each feature:

- [Why ai-armor?](/guide/why) -- The problem and how ai-armor solves it
- [Rate Limiting](/guide/rate-limiting) -- Sliding window, custom keys, external storage
- [Cost Tracking](/guide/cost-tracking) -- Budgets, downgrade maps, 69 models
- [Caching](/guide/caching) -- O(1) LRU cache with TTL
- [Model Routing](/guide/model-routing) -- Aliases and tier-based routing
- [Safety](/guide/safety) -- Prompt injection, PII, blocked patterns
- [Logging](/guide/logging) -- Structured logs and dashboards

Integrations:

- [Vercel AI SDK](/integrations/ai-sdk) -- First-class middleware adapter
- [Nuxt Module](/integrations/nuxt) -- Auto-imported composables

Reference:

- [API Reference: createArmor](/api/create-armor) -- Full API documentation
- [Types Reference](/api/types) -- All TypeScript interfaces
- [Provider Examples](/examples/providers) -- 18+ provider examples
