<p align="center">
  <h1 align="center">ai-armor</h1>
</p>

<p align="center">
  <strong>Production AI toolkit for TypeScript -- the LiteLLM for the JavaScript ecosystem.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/ai-armor"><img src="https://img.shields.io/npm/v/ai-armor?color=yellow&label=npm" alt="npm version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://github.com/billymaulana/ai-armor/actions/workflows/ci.yml"><img src="https://github.com/billymaulana/ai-armor/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/ai-armor"><img src="https://img.shields.io/npm/dm/ai-armor?color=green" alt="npm downloads"></a>
  <a href="https://github.com/billymaulana/ai-armor"><img src="https://img.shields.io/github/stars/billymaulana/ai-armor?style=social" alt="GitHub stars"></a>
  <a href="https://stackblitz.com/github/billymaulana/ai-armor/tree/main/playground-nuxt"><img src="https://developer.stackblitz.com/img/open_in_stackblitz_small.svg" alt="Open in StackBlitz"></a>
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
| **Response Caching** | Exact-match cache with LRU eviction and configurable TTL |
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
      'claude-sonnet-4-6': 'claude-haiku-3.5',
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
    driver: 'memory',
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
      // Send to your observability platform
      // e.g. send to DataDog, Grafana, or your own analytics
      process.stdout.write(`[${log.model}] ${log.cost.toFixed(4)}$ | ${log.latency}ms\n`)
    },
  },
})
```

---

## Vercel AI SDK Integration

ai-armor provides a first-class middleware adapter for the [Vercel AI SDK](https://sdk.vercel.ai/). Every request is automatically rate-limited, budget-checked, safety-scanned, cached, and logged.

```ts
import { openai } from '@ai-sdk/openai'
import { generateText, wrapLanguageModel } from 'ai'
import { aiArmorMiddleware } from 'ai-armor/ai-sdk'

// Wrap any model with ai-armor protection
const protectedModel = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: aiArmorMiddleware(armor, { userId: 'user-123' }),
})

// Use it exactly like a normal AI SDK model
const { text } = await generateText({
  model: protectedModel,
  prompt: 'Explain quantum computing in one paragraph.',
})
```

What happens behind the scenes:

1. Safety guard scans the prompt for injection attempts and PII
2. Rate limiter checks the user's request count
3. Budget controller verifies spending limits (downgrades model if needed)
4. Cache returns a stored response if an identical request was made recently
5. On completion, tokens and cost are tracked and logged

### Streaming Support

Streaming works out of the box. The `wrapStream` hook automatically tracks cost and tokens when the stream completes:

```ts
import { streamText } from 'ai'

const { textStream } = streamText({
  model: protectedModel,
  prompt: 'Write a haiku about TypeScript.',
})

for await (const chunk of textStream) {
  process.stdout.write(chunk)
}
// Cost tracked automatically on stream completion
```

---

## HTTP Middleware (Express / h3)

Use ai-armor as HTTP middleware for any Node.js server. It handles rate limiting, safety checks, budget enforcement, and caching at the request level.

```ts
import { createArmor } from 'ai-armor'
import { createArmorHandler } from 'ai-armor/http'
import express from 'express'

const app = express()
app.use(express.json())

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'ip', limit: 60, window: '1m' }],
  },
  budget: {
    daily: 100,
    monthly: 1000,
    onExceeded: 'block',
  },
  safety: {
    promptInjection: true,
    piiDetection: true,
  },
})

// Protect your AI routes
app.use('/api/ai', createArmorHandler(armor, {
  contextFromRequest: req => ({
    userId: req.headers['x-user-id'] as string,
    ip: req.headers['x-forwarded-for'] as string,
    apiKey: req.headers['x-api-key'] as string,
  }),
}))

// Your AI endpoint (only reached if armor allows it)
app.post('/api/ai/chat', async (req, res) => {
  // Request has been rate-limited, safety-checked, and budget-verified
  // req.body.model may have been resolved from alias or downgraded
  const result = await callYourAIProvider(req.body)
  res.json(result)
})

app.listen(3000)
```

Response headers are automatically set:

- `X-RateLimit-Remaining` -- requests left in the current window
- `X-RateLimit-Reset` -- timestamp when the window resets
- `Retry-After` -- seconds until the client can retry (on 429)

---

## Nuxt Module

The `@ai-armor/nuxt` module provides auto-imported composables, server-side middleware, and built-in admin API routes.

### Install

```bash
pnpm add @ai-armor/nuxt
```

### Configure

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@ai-armor/nuxt'],

  aiArmor: {
    rateLimit: {
      strategy: 'sliding-window',
      rules: [{ key: 'ip', limit: 30, window: '1m' }],
    },
    budget: {
      daily: 50,
      monthly: 500,
      onExceeded: 'warn',
    },
    routing: {
      aliases: { fast: 'gpt-4o-mini', smart: 'claude-sonnet-4-6' },
    },
    safety: {
      promptInjection: true,
      piiDetection: true,
    },
  },
})
```

### Auto-Imported Composables

```vue
<script setup lang="ts">
// All composables are auto-imported -- no import needed

// Track cost and budget
const { todayCost, monthCost, budget, isNearLimit } = useArmorCost()

// Monitor system health
const { isHealthy, rateLimitRemaining } = useArmorStatus()

// Track safety events on the client
const { blockCount, blockReason, recordBlock } = useArmorSafety()
</script>

<template>
  <div>
    <p>Today: ${{ todayCost.toFixed(2) }} / ${{ budget.daily }}</p>
    <p v-if="isNearLimit">
      Warning: approaching daily budget limit
    </p>
    <p>Rate limit remaining: {{ rateLimitRemaining }}</p>
  </div>
</template>
```

### Built-in API Routes

| Route | Description |
|:---|:---|
| `GET /api/_armor/status` | Health status, rate limit info |
| `GET /api/_armor/usage` | Cost tracking, budget utilization |

---

## Playground

Try ai-armor without installing anything:

<a href="https://stackblitz.com/github/billymaulana/ai-armor/tree/main/playground-nuxt"><img src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" alt="Open in StackBlitz"></a>

The Nuxt playground includes:
- Interactive chat demo with mock AI (no API key needed)
- Real-time cost tracking dashboard
- Rate limiting in action
- Safety guardrail demos (prompt injection detection)
- Budget controls with model downgrade

```bash
# Or run locally
git clone https://github.com/billymaulana/ai-armor.git
cd ai-armor
pnpm install
pnpm playground:nuxt
```

---

## Feature Reference

| Feature | Config Key | One-Liner |
|:---|:---|:---|
| Rate Limiting | `rateLimit` | Sliding-window rate limiter with per-user, per-IP, and per-API-key rules |
| Cost Tracking | `budget` | Automatic token counting and cost calculation for 100+ models |
| Budget Controls | `budget.onExceeded` | Block requests, warn, or auto-downgrade to a cheaper model |
| Fallback Chains | `fallback` | Retry failed requests across providers with exponential backoff |
| Response Caching | `cache` | Exact-match cache with LRU eviction, configurable TTL and max size |
| Model Routing | `routing` | Map semantic aliases to concrete model identifiers |
| Prompt Injection | `safety.promptInjection` | Detect and block common prompt injection patterns |
| PII Detection | `safety.piiDetection` | Detect emails, phone numbers, SSNs, and other PII in prompts |
| Token Limits | `safety.maxTokensPerRequest` | Reject prompts that exceed a token count threshold |
| Blocked Patterns | `safety.blockedPatterns` | Block requests matching custom regex patterns |
| Request Logging | `logging` | Structured per-request logs with model, tokens, cost, and latency |
| Custom Storage | `rateLimit.store` | Plug in Redis or any async key-value store for distributed deployments |

---

## Comparison

| Capability | ai-armor | LiteLLM | Portkey | Vercel AI SDK |
|:---|:---:|:---:|:---:|:---:|
| Embeddable (npm library) | Yes | No (proxy) | No (SaaS) | Yes |
| TypeScript native | Yes | No (Python) | Yes | Yes |
| Self-hosted | Yes | Yes | Partial | N/A |
| Rate limiting | Yes | Yes | No | No |
| Cost tracking + budgets | Yes | Yes | Yes (SaaS) | No |
| Fallback chains | Yes | Yes | Yes | No |
| Response caching | Yes | Yes | Yes | No |
| Safety guardrails | Yes | No | No | No |
| Model alias routing | Yes | Yes | No | No |
| Zero external dependencies | Yes | No | No | Yes |

---

## Tech Stack

- **Language:** TypeScript (strict mode, zero `any`)
- **Build:** tsdown (ESM + CJS dual output)
- **Test:** Vitest (265+ tests, >80% coverage)
- **Lint:** @antfu/eslint-config
- **Monorepo:** pnpm workspaces
- **Release:** Changesets + GitHub Actions

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, coding standards, and the PR process.

```bash
# Clone and install
git clone https://github.com/billymaulana/ai-armor.git
cd ai-armor
pnpm install

# Run tests
pnpm test

# Run quality checks (lint + typecheck + tests)
pnpm quality
```

---

## License

[MIT](./LICENSE) -- Created by [Billy Maulana](https://github.com/billymaulana)
