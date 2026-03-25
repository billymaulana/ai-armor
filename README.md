<p align="center">
  <img src="https://raw.githubusercontent.com/billymaulana/ai-armor/main/.github/logo-dark.svg" alt="AI ARMOR" width="200" />
</p>

<p align="center">
  <strong>Stop your AI APIs from draining your wallet. One package. Zero proxies.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/ai-armor"><img src="https://img.shields.io/npm/v/ai-armor?color=yellow&label=npm" alt="npm"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT"></a>
  <a href="https://github.com/billymaulana/ai-armor/actions/workflows/ci.yml"><img src="https://github.com/billymaulana/ai-armor/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/coverage-99.6%25-brightgreen" alt="96.6%">
  <a href="https://github.com/billymaulana/ai-armor"><img src="https://img.shields.io/github/stars/billymaulana/ai-armor?style=social" alt="stars"></a>
</p>

<p align="center">
  <a href="https://billymaulana.github.io/ai-armor/">Docs</a> &bull;
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#why-ai-armor">Why?</a> &bull;
  <a href="https://github.com/billymaulana/ai-armor/issues">Issues</a>
</p>

---

## Why ai-armor?

You ship an AI feature. It works great. Then:

- A user discovers your endpoint and loops it 10,000 times -- **$800 gone**
- Your OpenAI key hits rate limits during a demo -- **no fallback**
- Someone pastes their SSN into your chatbot -- **PII leak**
- You have no idea which model costs the most -- **zero visibility**

Every team rebuilds these guardrails from scratch. **ai-armor gives you all of them in one `npm install`.**

> [LiteLLM](https://github.com/BerriAI/litellm) solved this for Python (39K+ stars). ai-armor is the TypeScript equivalent -- but embeddable, not a proxy.

---

## Quick Start

```bash
pnpm add ai-armor
```

```ts
import { createArmor } from 'ai-armor'

const armor = createArmor({
  // Limit users to 20 requests/minute
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 20, window: '1m' }],
  },

  // Cap spending at $50/day, auto-downgrade expensive models
  budget: {
    daily: 50,
    monthly: 500,
    onExceeded: 'downgrade-model',
    downgradeMap: { 'gpt-4o': 'gpt-4o-mini' },
  },

  // Block prompt injection and PII before it reaches the API
  safety: {
    promptInjection: true,
    piiDetection: true,
    maxTokensPerRequest: 4096,
  },

  // Cache identical requests (save money on repeated questions)
  cache: { enabled: true, strategy: 'exact', ttl: 300, maxSize: 500 },
})
```

That's it. Every AI request through this instance is now rate-limited, budget-controlled, safety-scanned, and cached.

---

## What You Get

| | Feature | What it does |
|:---:|:---|:---|
| :shield: | **Rate Limiting** | Sliding-window per-user, per-IP, per-API-key |
| :moneybag: | **Cost Tracking** | Auto-pricing for 100+ models, daily/monthly/per-user budgets |
| :repeat: | **Fallback Chains** | If OpenAI fails, try Anthropic, then Gemini -- with circuit breaker |
| :zap: | **Response Caching** | Exact-match + semantic (embedding) cache with LRU eviction |
| :lock: | **Safety Guardrails** | 26 injection patterns, 6 PII detectors, token limits, custom regex |
| :arrows_counterclockwise: | **Model Routing** | `fast` -> `gpt-4o-mini`, `smart` -> `claude-sonnet-4-6` |
| :bar_chart: | **Observability** | Per-request structured logs with cost, latency, tokens |
| :elephant: | **Redis Adapter** | Distributed rate limiting for multi-server deployments |

---

## Works With Everything

### Vercel AI SDK

```ts
import { aiArmorMiddleware } from 'ai-armor/ai-sdk'

const model = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: aiArmorMiddleware(armor, { userId: 'user-123' }),
})

// generateText and streamText -- both protected automatically
const { text } = await generateText({ model, prompt: 'Hello!' })
```

### Express / h3 / Connect

```ts
import { createArmorHandler } from 'ai-armor/http'

app.use('/api/ai', createArmorHandler(armor))
// 403 = safety blocked, 429 = rate limited, 402 = budget exceeded
```

### Nuxt 3/4

```bash
pnpm add @ai-armor/nuxt
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@ai-armor/nuxt'],
  aiArmor: {
    rateLimit: { strategy: 'sliding-window', rules: [{ key: 'ip', limit: 30, window: '1m' }] },
    budget: { daily: 50, monthly: 500, onExceeded: 'warn' },
    safety: { promptInjection: true, piiDetection: true },
  },
})
```

Auto-imported composables: `useArmorCost()`, `useArmorStatus()`, `useArmorSafety()`

---

## Redis for Production

Single server? In-memory works fine. Multiple servers or serverless? Use Redis:

```ts
import { createRedisAdapter } from 'ai-armor/redis'

const adapter = createRedisAdapter(new Redis(), { prefix: 'myapp:' })
const armor = createArmor({
  rateLimit: { strategy: 'sliding-window', rules: [/* ... */], store: adapter },
  budget: { daily: 50, onExceeded: 'block', store: adapter },
})
```

Works with ioredis, @upstash/redis, or any Redis-compatible client.

---

## Semantic Caching

Not just exact matches -- cache similar questions too:

```ts
const armor = createArmor({
  cache: {
    enabled: true,
    strategy: 'semantic',
    ttl: 3600,
    similarityThreshold: 0.92,
    embeddingFn: async (text) => {
      // Use any embedding provider
      return await getEmbedding(text)
    },
  },
})
```

"What is TypeScript?" and "Explain TypeScript to me" hit the same cached response.

---

## How It Compares

| | ai-armor | LiteLLM | Portkey | Vercel AI SDK |
|:---|:---:|:---:|:---:|:---:|
| Embeddable (npm) | :white_check_mark: | :x: proxy | :x: SaaS | :white_check_mark: |
| TypeScript native | :white_check_mark: | :x: Python | :white_check_mark: | :white_check_mark: |
| Rate limiting | :white_check_mark: | :white_check_mark: | :x: | :x: |
| Cost + budgets | :white_check_mark: | :white_check_mark: | :white_check_mark: SaaS | :x: |
| Safety guardrails | :white_check_mark: | :x: | :x: | :x: |
| Semantic cache | :white_check_mark: | :x: | :x: | :x: |
| Redis adapter | :white_check_mark: | :white_check_mark: | N/A | :x: |
| Nuxt module | :white_check_mark: | :x: | :x: | :x: |
| Dependencies | 1 | Many | Many | Few |

---

## Packages

| Package | Install |
|:---|:---|
| [`ai-armor`](https://www.npmjs.com/package/ai-armor) | `pnpm add ai-armor` |
| [`@ai-armor/nuxt`](https://www.npmjs.com/package/@ai-armor/nuxt) | `pnpm add @ai-armor/nuxt` |

---

## Sponsors

<p align="center">
  <sub>ai-armor saves you money on AI costs. Consider supporting development:</sub>
</p>

<p align="center">
  <a href="https://github.com/sponsors/billymaulana">
    <img src="https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-ea4aaa?logo=github&logoColor=white" alt="Sponsor">
  </a>
</p>

---

## License

[MIT](./LICENSE) -- [Billy Maulana](https://github.com/billymaulana)
