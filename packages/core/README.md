<p align="center">
  <img src="https://raw.githubusercontent.com/billymaulana/ai-armor/main/.github/logo.png" alt="ai-armor" width="280" />
</p>

<h1 align="center">ai-armor</h1>

<p align="center">
  <strong>Production AI toolkit for TypeScript -- rate limiting, cost tracking, fallback, caching, safety guardrails.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/ai-armor"><img src="https://img.shields.io/npm/v/ai-armor?color=yellow&label=npm" alt="npm version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/coverage-99.6%25-brightgreen" alt="Coverage: 96.6%">
  <a href="https://github.com/billymaulana/ai-armor"><img src="https://img.shields.io/github/stars/billymaulana/ai-armor?style=social" alt="GitHub stars"></a>
</p>

---

## Install

```bash
pnpm add ai-armor
```

## Quick Start

```ts
import { createArmor } from 'ai-armor'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 20, window: '1m' }],
  },
  budget: {
    daily: 50,
    monthly: 500,
    onExceeded: 'downgrade-model',
    downgradeMap: { 'gpt-4o': 'gpt-4o-mini' },
  },
  safety: { promptInjection: true, piiDetection: true },
  cache: { enabled: true, strategy: 'exact', ttl: 300, maxSize: 500 },
})
```

## Features

| Feature | Description |
|:---|:---|
| **Rate Limiting** | Sliding-window, per-user / per-IP / per-API-key |
| **Cost Tracking** | 100+ model pricing, daily/monthly/per-user budgets |
| **Fallback Chains** | Circuit breaker + exponential backoff |
| **Caching** | Exact-match + semantic (embedding) with LRU |
| **Redis Adapter** | Official distributed storage adapter |
| **Safety** | Prompt injection + PII detection + token limits |
| **AI SDK Middleware** | Vercel AI SDK v6+ integration |
| **HTTP Middleware** | Express / h3 / Connect compatible |

## Integrations

```ts
// Vercel AI SDK
import { aiArmorMiddleware } from 'ai-armor/ai-sdk'

// HTTP middleware
import { createArmorHandler } from 'ai-armor/http'

// Redis adapter
import { createRedisAdapter } from 'ai-armor/redis'
```

## Documentation

Full docs: [billymaulana.github.io/ai-armor](https://billymaulana.github.io/ai-armor/)

## License

[MIT](https://github.com/billymaulana/ai-armor/blob/main/LICENSE) -- [Billy Maulana](https://github.com/billymaulana)
