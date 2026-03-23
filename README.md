<p align="center">
  <img src="https://raw.githubusercontent.com/billymaulana/ai-armor/main/.github/logo.png" alt="ai-armor" width="280" />
</p>

<h1 align="center">ai-armor</h1>

<p align="center">
  <strong>Production AI toolkit for TypeScript -- the LiteLLM for the JavaScript ecosystem.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/ai-armor"><img src="https://img.shields.io/npm/v/ai-armor?color=yellow&label=npm" alt="npm version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://github.com/billymaulana/ai-armor/actions/workflows/ci.yml"><img src="https://github.com/billymaulana/ai-armor/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/coverage-96.6%25-brightgreen" alt="Coverage: 96.6%">
  <a href="https://www.npmjs.com/package/ai-armor"><img src="https://img.shields.io/npm/dm/ai-armor?color=green" alt="npm downloads"></a>
  <a href="https://github.com/billymaulana/ai-armor"><img src="https://img.shields.io/github/stars/billymaulana/ai-armor?style=social" alt="GitHub stars"></a>
</p>

<p align="center">
  <a href="https://billymaulana.github.io/ai-armor/">Documentation</a> &bull;
  <a href="https://stackblitz.com/github/billymaulana/ai-armor/tree/main/playground-nuxt">Playground</a> &bull;
  <a href="https://github.com/billymaulana/ai-armor/issues">Issues</a>
</p>

<p align="center">
  Rate limiting, cost tracking, budget controls, fallback chains, caching, model routing, safety guardrails, and observability -- all in one <code>npm</code> package. Zero proxies. Zero external services. Just TypeScript.
</p>

---

## The Problem

Every production AI application rebuilds the same infrastructure from scratch: rate limiters, cost trackers, fallback logic, caching layers, safety filters. Meanwhile:

- 65% of IT leaders report **unexpected AI API charges**
- Actual costs run **30-50% over initial estimates**
- A single unguarded endpoint can drain your API budget in minutes

[LiteLLM](https://github.com/BerriAI/litellm) (39K+ stars) solved this for Python. **ai-armor** brings the same power to TypeScript -- as an embeddable library, not a proxy service.

---

## Features

| Feature | Description |
|:---|:---|
| **Rate Limiting** | Sliding-window algorithm, per-user / per-IP / per-API-key rules |
| **Cost Tracking** | Automatic token counting with built-in pricing for 100+ models |
| **Budget Controls** | Daily / monthly / per-user limits -- block, warn, or auto-downgrade model |
| **Fallback Chains** | Health-tracked provider chains with retries and exponential backoff |
| **Response Caching** | Exact-match and semantic (embedding) cache with LRU eviction |
| **Redis Adapter** | Official Redis storage adapter for distributed rate limiting and budgets |
| **Model Alias Routing** | Semantic aliases (`fast` -> `gpt-4o-mini`, `smart` -> `claude-sonnet-4-6`) |
| **Safety Guardrails** | Prompt injection detection, PII detection, token limits, blocked patterns |
| **Structured Logging** | Per-request observability with hooks for external systems |
| **AI SDK Middleware** | Drop-in adapter for Vercel AI SDK -- `generateText` and `streamText` |
| **HTTP Middleware** | Express / h3 / Connect-compatible request handler |
| **Nuxt Module** | Auto-imported composables, server middleware, and admin API routes |

---

## Packages

| Package | Description | Install |
|:---|:---|:---|
| [`ai-armor`](./packages/core) | Framework-agnostic core library | `pnpm add ai-armor` |
| [`@ai-armor/nuxt`](./packages/nuxt) | Nuxt module with auto-imports and composables | `pnpm add @ai-armor/nuxt` |

---

## Quick Start

### Install

```bash
pnpm add ai-armor
```

### Create an Armor Instance

```ts
import { createArmor } from 'ai-armor'

const armor = createArmor({
  // Rate limiting: 20 requests per minute per user
  rateLimit: {
    strategy: 'sliding-window',
    rules: [
      { key: 'user', limit: 20, window: '1m' },
      { key: 'ip', limit: 100, window: '1h' },
    ],
  },

  // Budget: $50/day, $500/month -- auto-downgrade when exceeded
  budget: {
    daily: 50,
    monthly: 500,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'gpt-4o': 'gpt-4o-mini',
      'claude-sonnet-4-6': 'claude-haiku-4-5',
    },
  },

  // Fallback: if OpenAI fails, try Anthropic
  fallback: {
    chains: {
      'gpt-4o': ['gpt-4o', 'claude-sonnet-4-6', 'gemini-2.0-flash'],
    },
    retries: 2,
    backoff: 'exponential',
    healthCheck: true,
  },

  // Cache identical requests for 5 minutes
  cache: {
    enabled: true,
    strategy: 'exact',
    ttl: 300,
    maxSize: 500,
  },

  // Model aliases for cleaner code
  routing: {
    aliases: {
      fast: 'gpt-4o-mini',
      smart: 'claude-sonnet-4-6',
      vision: 'gpt-4o',
    },
  },

  // Safety: block prompt injection, detect PII, enforce token limits
  safety: {
    promptInjection: true,
    piiDetection: true,
    maxTokensPerRequest: 4096,
  },

  // Logging: track everything
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency', 'cached', 'fallback'],
    onRequest: (log) => {
      process.stdout.write(`[${log.model}] ${log.cost.toFixed(4)}$ | ${log.latency}ms\n`)
    },
  },
})
```

---

## Vercel AI SDK Integration

ai-armor provides a first-class middleware adapter for the [Vercel AI SDK](https://sdk.vercel.ai/).

```ts
import { openai } from '@ai-sdk/openai'
import { generateText, wrapLanguageModel } from 'ai'
import { aiArmorMiddleware } from 'ai-armor/ai-sdk'

const protectedModel = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: aiArmorMiddleware(armor, { userId: 'user-123' }),
})

const { text } = await generateText({
  model: protectedModel,
  prompt: 'Explain quantum computing in one paragraph.',
})
```

### Streaming Support

```ts
import { streamText } from 'ai'

const { textStream } = streamText({
  model: protectedModel,
  prompt: 'Write a haiku about TypeScript.',
})

for await (const chunk of textStream) {
  process.stdout.write(chunk)
}
```

---

## HTTP Middleware (Express / h3)

```ts
import { createArmor } from 'ai-armor'
import { createArmorHandler } from 'ai-armor/http'
import express from 'express'

const app = express()
app.use(express.json())

app.use('/api/ai', createArmorHandler(armor, {
  contextFromRequest: req => ({
    userId: req.headers['x-user-id'] as string,
    ip: req.headers['x-forwarded-for'] as string,
  }),
}))

app.listen(3000)
```

---

## Nuxt Module

```bash
pnpm add @ai-armor/nuxt
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@ai-armor/nuxt'],
  aiArmor: {
    rateLimit: {
      strategy: 'sliding-window',
      rules: [{ key: 'ip', limit: 30, window: '1m' }],
    },
    budget: { daily: 50, monthly: 500, onExceeded: 'warn' },
    safety: { promptInjection: true, piiDetection: true },
  },
})
```

### Auto-Imported Composables

| Composable | Purpose |
|:---|:---|
| `useArmorCost()` | Track daily/monthly cost, budget proximity |
| `useArmorStatus()` | Health check, rate limit remaining |
| `useArmorSafety()` | Safety event tracking, block counts |

### Built-in API Routes

| Route | Description |
|:---|:---|
| `GET /api/_armor/status` | Health status, rate limit info |
| `GET /api/_armor/usage` | Cost tracking, budget utilization |
| `POST /api/_armor/safety` | Safety check for text content |

All admin routes are protected by `adminSecret` when configured.

---

## Redis Adapter

```ts
import { createArmor, createRedisAdapter } from 'ai-armor'
import Redis from 'ioredis'

const adapter = createRedisAdapter(new Redis(), { prefix: 'myapp:', ttl: 86400 })

const armor = createArmor({
  rateLimit: { strategy: 'sliding-window', rules: [{ key: 'user', limit: 20, window: '1m' }], store: adapter },
  budget: { daily: 50, monthly: 500, onExceeded: 'block', store: adapter },
})
```

Works with ioredis, @upstash/redis, or any Redis-compatible client. Also available as `import { createRedisAdapter } from 'ai-armor/redis'`.

---

## Semantic Caching

```ts
import { openai } from '@ai-sdk/openai'
import { createArmor } from 'ai-armor'

const armor = createArmor({
  cache: {
    enabled: true,
    strategy: 'semantic',
    ttl: 3600,
    maxSize: 1000,
    similarityThreshold: 0.92,
    embeddingFn: async (text) => {
      const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text })
      return res.data[0].embedding
    },
  },
})
```

Returns cached responses for semantically similar prompts using cosine similarity.

---

## Comparison

| Capability | ai-armor | LiteLLM | Portkey | Vercel AI SDK |
|:---|:---:|:---:|:---:|:---:|
| Embeddable (npm library) | :white_check_mark: | :x: (proxy) | :x: (SaaS) | :white_check_mark: |
| TypeScript native | :white_check_mark: | :x: (Python) | :white_check_mark: | :white_check_mark: |
| Self-hosted | :white_check_mark: | :white_check_mark: | :warning: Partial | N/A |
| Rate limiting | :white_check_mark: | :white_check_mark: | :x: | :x: |
| Cost tracking + budgets | :white_check_mark: | :white_check_mark: | :white_check_mark: (SaaS) | :x: |
| Fallback chains | :white_check_mark: | :white_check_mark: | :white_check_mark: | :x: |
| Response caching | :white_check_mark: | :white_check_mark: | :white_check_mark: | :x: |
| Semantic caching | :white_check_mark: | :x: | :x: | :x: |
| Safety guardrails | :white_check_mark: | :x: | :x: | :x: |
| Redis adapter | :white_check_mark: | :white_check_mark: | N/A | :x: |
| Nuxt module | :white_check_mark: | :x: | :x: | :x: |
| Minimal dependencies | :white_check_mark: (1 dep) | :x: | :x: | :white_check_mark: |

---

## Sponsors

<p align="center">
  <em>ai-armor is free and open source. If it saves you money on AI costs, consider sponsoring!</em>
</p>

<p align="center">
  <a href="https://github.com/sponsors/billymaulana">
    <img src="https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-ea4aaa?logo=github&logoColor=white" alt="Sponsor on GitHub">
  </a>
</p>

---

## License

[MIT](./LICENSE) -- [Billy Maulana](https://github.com/billymaulana)
