# Provider Examples

ai-armor works with any AI provider. This page shows how to integrate with each supported provider, with links to full example files.

## Supported Providers

| Provider | Example File | SDK | Compatibility |
|---|---|---|---|
| OpenAI | [`with-openai.ts`](https://github.com/billymaulana/ai-armor/blob/main/examples/with-openai.ts) | `openai` | Native SDK |
| Anthropic | [`with-anthropic.ts`](https://github.com/billymaulana/ai-armor/blob/main/examples/with-anthropic.ts) | `@anthropic-ai/sdk` | Native SDK |
| Google Gemini | [`with-google-gemini.ts`](https://github.com/billymaulana/ai-armor/blob/main/examples/with-google-gemini.ts) | `@google/generative-ai` | Native SDK |
| Mistral | [`with-mistral.ts`](https://github.com/billymaulana/ai-armor/blob/main/examples/with-mistral.ts) | `@mistralai/mistralai` | Native SDK |
| Cohere | [`with-cohere.ts`](https://github.com/billymaulana/ai-armor/blob/main/examples/with-cohere.ts) | `cohere-ai` | Native SDK |
| AWS Bedrock | [`with-aws-bedrock.ts`](https://github.com/billymaulana/ai-armor/blob/main/examples/with-aws-bedrock.ts) | `@aws-sdk/client-bedrock-runtime` | Native SDK |
| Azure OpenAI | [`with-azure-openai.ts`](https://github.com/billymaulana/ai-armor/blob/main/examples/with-azure-openai.ts) | `openai` | OpenAI-compatible |
| Groq | [`with-groq.ts`](https://github.com/billymaulana/ai-armor/blob/main/examples/with-groq.ts) | `openai` | OpenAI-compatible |
| Together AI | [`with-together-ai.ts`](https://github.com/billymaulana/ai-armor/blob/main/examples/with-together-ai.ts) | `openai` | OpenAI-compatible |
| Fireworks | [`with-fireworks.ts`](https://github.com/billymaulana/ai-armor/blob/main/examples/with-fireworks.ts) | `openai` | OpenAI-compatible |
| Perplexity | [`with-perplexity.ts`](https://github.com/billymaulana/ai-armor/blob/main/examples/with-perplexity.ts) | `openai` | OpenAI-compatible |
| Moonshot (Kimi) | [`with-moonshot.ts`](https://github.com/billymaulana/ai-armor/blob/main/examples/with-moonshot.ts) | `openai` | OpenAI-compatible |
| Zhipu (GLM) | [`with-zhipu-glm.ts`](https://github.com/billymaulana/ai-armor/blob/main/examples/with-zhipu-glm.ts) | `openai` | OpenAI-compatible |
| Alibaba Qwen | [`with-qwen.ts`](https://github.com/billymaulana/ai-armor/blob/main/examples/with-qwen.ts) | `openai` | OpenAI-compatible |
| DeepSeek | via OpenAI SDK | `openai` | OpenAI-compatible |
| xAI (Grok) | via OpenAI SDK | `openai` | OpenAI-compatible |
| Multi-provider | [`multi-provider.ts`](https://github.com/billymaulana/ai-armor/blob/main/examples/multi-provider.ts) | Multiple | Mixed |

## OpenAI-Compatible Providers

Many providers expose an OpenAI-compatible API. Use the `openai` SDK with a custom `baseURL`:

### Groq

```ts
import { createArmor } from 'ai-armor'
import OpenAI from 'openai'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 60, window: '1m' }],
  },
  budget: {
    daily: 10,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'llama3-70b-8192': 'gemma2-9b-it',
      'mixtral-8x7b-32768': 'gemma2-9b-it',
    },
  },
  routing: {
    aliases: {
      fast: 'gemma2-9b-it',
      balanced: 'mixtral-8x7b-32768',
      smart: 'llama3-70b-8192',
      scout: 'llama-4-scout',
    },
  },
})

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
})
```

### Together AI

```ts
const together = new OpenAI({
  apiKey: process.env.TOGETHER_API_KEY,
  baseURL: 'https://api.together.xyz/v1',
})

// Models use full path names
const armor = createArmor({
  routing: {
    aliases: {
      fast: 'meta-llama/Llama-4-Scout-17B-16E-Instruct',
      smart: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      qwen: 'Qwen/Qwen2.5-72B-Instruct-Turbo',
    },
  },
})
```

### Fireworks AI

```ts
const fireworks = new OpenAI({
  apiKey: process.env.FIREWORKS_API_KEY,
  baseURL: 'https://api.fireworks.ai/inference/v1',
})

const armor = createArmor({
  routing: {
    aliases: {
      fast: 'accounts/fireworks/models/qwen3-8b',
      smart: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    },
  },
})
```

### Perplexity

```ts
const perplexity = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY,
  baseURL: 'https://api.perplexity.ai',
})

const armor = createArmor({
  routing: {
    aliases: {
      'search': 'sonar-pro',
      'search-fast': 'sonar',
    },
  },
})
```

### Moonshot (Kimi)

```ts
const moonshot = new OpenAI({
  apiKey: process.env.MOONSHOT_API_KEY,
  baseURL: 'https://api.moonshot.cn/v1',
})

const armor = createArmor({
  routing: { aliases: { kimi: 'kimi-k2.5' } },
})
```

### Zhipu (GLM)

```ts
const zhipu = new OpenAI({
  apiKey: process.env.ZHIPU_API_KEY,
  baseURL: 'https://open.bigmodel.cn/api/paas/v4',
})

const armor = createArmor({
  routing: { aliases: { glm: 'glm-5' } },
})
```

### Alibaba Qwen

```ts
const qwen = new OpenAI({
  apiKey: process.env.QWEN_API_KEY,
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
})

const armor = createArmor({
  routing: {
    aliases: {
      fast: 'qwen-plus',
      smart: 'qwen2.5-max',
    },
  },
})
```

### DeepSeek

```ts
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
})

const armor = createArmor({
  routing: {
    aliases: {
      chat: 'deepseek-chat',
      reasoning: 'deepseek-reasoner',
    },
  },
})
```

### xAI (Grok)

```ts
const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
})

const armor = createArmor({
  routing: {
    aliases: {
      'grok': 'grok-2',
      'grok-fast': 'grok-2-mini',
    },
  },
})
```

## Native SDK Providers

### OpenAI

```ts
import { createArmor } from 'ai-armor'
import OpenAI from 'openai'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 30, window: '1m' }],
  },
  budget: {
    daily: 100,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'gpt-4o': 'gpt-4o-mini',
      'o1': 'o1-mini',
    },
  },
  routing: {
    aliases: { fast: 'gpt-4o-mini', smart: 'gpt-4o', reasoning: 'o1' },
  },
})

const openai = new OpenAI()

async function chat(userId: string, model: string, message: string) {
  const ctx = { userId }
  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed)
    throw new Error('Rate limited')

  const resolved = armor.resolveModel(model)
  const budget = await armor.checkBudget(resolved, ctx)
  if (!budget.allowed)
    throw new Error('Budget exceeded')
  const finalModel = budget.suggestedModel ?? resolved

  const response = await openai.chat.completions.create({
    model: finalModel,
    messages: [{ role: 'user', content: message }],
  })

  const usage = response.usage!
  await armor.trackCost(finalModel, usage.prompt_tokens, usage.completion_tokens, userId)

  return response.choices[0]?.message?.content ?? ''
}
```

### Anthropic

```ts
import Anthropic from '@anthropic-ai/sdk'
import { createArmor } from 'ai-armor'

const armor = createArmor({
  budget: {
    daily: 50,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'claude-opus-4-20250514': 'claude-sonnet-4-20250514',
      'claude-sonnet-4-20250514': 'claude-haiku-4-5-20251001',
    },
  },
  routing: {
    aliases: {
      fast: 'claude-haiku-4-5-20251001',
      balanced: 'claude-sonnet-4-20250514',
      best: 'claude-opus-4-20250514',
    },
  },
})

const client = new Anthropic()

async function chat(userId: string, model: string, message: string) {
  const resolved = armor.resolveModel(model)
  const budget = await armor.checkBudget(resolved, { userId })
  const finalModel = budget.suggestedModel ?? resolved

  const response = await client.messages.create({
    model: finalModel,
    max_tokens: 1024,
    messages: [{ role: 'user', content: message }],
  })

  const content = response.content[0]?.type === 'text' ? response.content[0].text : ''
  await armor.trackCost(finalModel, response.usage.input_tokens, response.usage.output_tokens, userId)

  return content
}
```

### Google Gemini

```ts
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createArmor } from 'ai-armor'

const armor = createArmor({
  budget: {
    daily: 30,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'gemini-2.5-pro': 'gemini-2.5-flash',
      'gemini-2.5-flash': 'gemini-2.0-flash',
    },
  },
  routing: {
    aliases: {
      fast: 'gemini-2.0-flash',
      balanced: 'gemini-2.5-flash',
      best: 'gemini-2.5-pro',
    },
  },
})

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)

async function chat(userId: string, model: string, message: string) {
  const resolved = armor.resolveModel(model)
  const budget = await armor.checkBudget(resolved, { userId })
  const finalModel = budget.suggestedModel ?? resolved

  const geminiModel = genAI.getGenerativeModel({ model: finalModel })
  const result = await geminiModel.generateContent(message)

  const usage = result.response.usageMetadata
  const inputTokens = usage?.promptTokenCount ?? 0
  const outputTokens = usage?.candidatesTokenCount ?? 0

  await armor.trackCost(finalModel, inputTokens, outputTokens, userId)

  return result.response.text()
}
```

### Azure OpenAI

```ts
import { createArmor } from 'ai-armor'
import OpenAI from 'openai'

const armor = createArmor({
  routing: {
    aliases: {
      fast: 'gpt-4o-mini-azure',
      smart: 'gpt-4o-azure',
    },
  },
})

const azure = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_DEPLOYMENT}`,
  defaultQuery: { 'api-version': '2024-02-01' },
  defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY },
})
```

## Framework Examples

### Express

```ts
import { createArmor } from 'ai-armor'
import { createArmorHandler } from 'ai-armor/http'
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
  cache: { enabled: true, strategy: 'exact', ttl: 1800, maxSize: 2000 },
  routing: {
    aliases: { fast: 'gpt-4o-mini', smart: 'gpt-4o' },
  },
})

const app = express()
app.use(express.json())

// Apply armor middleware to all AI routes
app.use('/api/ai/*', createArmorHandler(armor, {
  contextFromRequest: req => ({
    userId: req.headers?.['x-user-id'] as string,
    apiKey: req.headers?.['x-api-key'] as string,
  }),
}))

app.post('/api/ai/chat', (req, res) => {
  // Rate limit, budget, and cache already checked
  // req.body.model is resolved (aliases expanded)
  res.json({ model: req.body.model })
})

app.listen(3000)
```

### Next.js (App Router)

```ts
import { openai } from '@ai-sdk/openai'
import { generateText, wrapLanguageModel } from 'ai'
// app/api/chat/route.ts
import { createArmor } from 'ai-armor'
import { aiArmorMiddleware } from 'ai-armor/ai-sdk'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 30, window: '1m' }],
  },
  budget: { daily: 100, onExceeded: 'warn' },
  cache: { enabled: true, strategy: 'exact', ttl: 3600 },
})

export async function POST(req: Request) {
  const { prompt, userId } = await req.json()

  const model = wrapLanguageModel({
    model: openai('gpt-4o'),
    middleware: aiArmorMiddleware(armor, { userId }),
  })

  try {
    const { text } = await generateText({ model, prompt })
    return Response.json({ text })
  }
  catch (error) {
    if (error instanceof Error && error.message.includes('[ai-armor]')) {
      return Response.json({ error: error.message }, { status: 429 })
    }
    throw error
  }
}
```

### Hono

```ts
import { createArmor } from 'ai-armor'
import { createArmorHandler } from 'ai-armor/http'
import { Hono } from 'hono'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'ip', limit: 60, window: '1m' }],
  },
  budget: { daily: 100, onExceeded: 'block' },
})

const app = new Hono()

app.post('/api/chat', async (c) => {
  const ctx = { ip: c.req.header('x-forwarded-for') ?? 'unknown' }

  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed) {
    return c.json({ error: 'Rate limited' }, 429)
  }

  const body = await c.req.json()
  const resolved = armor.resolveModel(body.model)
  const budget = await armor.checkBudget(resolved, ctx)
  if (!budget.allowed) {
    return c.json({ error: 'Budget exceeded' }, 402)
  }

  // Forward to AI provider...
  return c.json({ model: budget.suggestedModel ?? resolved })
})

export default app
```

### Fastify

```ts
import { createArmor } from 'ai-armor'
import Fastify from 'fastify'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 30, window: '1m' }],
  },
  budget: { daily: 100, onExceeded: 'block' },
})

const fastify = Fastify()

fastify.addHook('preHandler', async (request, reply) => {
  if (!request.url.startsWith('/api/ai'))
    return

  const ctx = {
    userId: request.headers['x-user-id'] as string,
    ip: request.ip,
  }

  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed) {
    reply.code(429).send({
      error: 'Rate limited',
      resetAt: new Date(rateLimit.resetAt).toISOString(),
    })
  }
})

fastify.post('/api/ai/chat', async (request, reply) => {
  // Rate limit already checked in preHandler
  return { ok: true }
})

fastify.listen({ port: 3000 })
```

### Nuxt

See the dedicated [Nuxt Integration](/integrations/nuxt) page for full module setup with auto-imported composables.

## Multi-Provider Setup

Use a single armor instance across all providers for unified rate limiting, budgets, and logging:

```ts
import { createArmor } from 'ai-armor'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 60, window: '1m' }],
  },
  budget: {
    daily: 200,
    monthly: 2000,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'gpt-4o': 'gpt-4o-mini',
      'claude-opus-4-20250514': 'claude-sonnet-4-20250514',
      'gemini-2.5-pro': 'gemini-2.5-flash',
    },
  },
  routing: {
    aliases: {
      fast: 'gpt-4o-mini',
      balanced: 'claude-sonnet-4-20250514',
      best: 'claude-opus-4-20250514',
      reasoning: 'o1',
      cheap: 'gemini-2.0-flash',
    },
  },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency', 'cached', 'userId'],
  },
})

// Use the same armor instance for all providers
// Budget is shared, rate limits are shared, logs are unified
```

See [`examples/multi-provider.ts`](https://github.com/billymaulana/ai-armor/blob/main/examples/multi-provider.ts) for the full working example.

## Related

- [Getting Started](/guide/getting-started) -- Quick start
- [AI SDK Integration](/integrations/ai-sdk) -- Vercel AI SDK middleware
- [Cost Tracking](/guide/cost-tracking) -- Supported models and pricing
- [Model Routing](/guide/model-routing) -- Alias configuration
