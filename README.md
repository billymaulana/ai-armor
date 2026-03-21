# ai-armor

[![npm version](https://img.shields.io/npm/v/ai-armor?color=yellow)](https://npmjs.com/package/ai-armor)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/billymaulana/ai-armor/actions/workflows/ci.yml/badge.svg)](https://github.com/billymaulana/ai-armor/actions/workflows/ci.yml)

**Production AI toolkit for TypeScript -- the LiteLLM for the JavaScript ecosystem.**

> Rate limiting, cost tracking, budget controls, fallback chains, caching, model routing, safety guardrails, and observability -- all in one npm package.

## Why ai-armor?

- 65% of IT leaders report **unexpected AI API charges**
- Actual costs run **30-50% over estimates**
- Every production AI app rebuilds the same utilities from scratch

[LiteLLM](https://github.com/BerriAI/litellm) (39.9K stars) solved this for Python. **ai-armor** brings the same power to TypeScript -- as an embeddable library, not a proxy service.

## Features

| Feature | Description |
|---|---|
| Rate Limiting | Sliding-window, fixed-window, token-bucket |
| Cost Tracking | Token counting + pricing DB for 100+ models |
| Budget Controls | Daily/monthly limits with block, warn, or auto-downgrade |
| Fallback Chains | Auto-switch providers on error/timeout |
| Caching | Exact-match cache with configurable TTL |
| Model Routing | Semantic aliases (`fast` -> `gpt-4o-mini`) |
| Safety Guardrails | Prompt injection & PII detection |
| Observability | Request logging with hooks |

## Quick Start

```bash
npm install ai-armor
```

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
  },
  routing: {
    aliases: { fast: 'gpt-4o-mini', smart: 'claude-sonnet-4-6' },
  },
})
```

### With Vercel AI SDK

```ts
import { openai } from '@ai-sdk/openai'
import { wrapLanguageModel } from 'ai'
import { aiArmorMiddleware } from 'ai-armor/ai-sdk'

const protectedModel = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: aiArmorMiddleware(armor),
})
```

### With Nuxt

```bash
npm install @ai-armor/nuxt
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@ai-armor/nuxt'],
  aiArmor: {
    budget: { daily: 50, monthly: 500, onExceeded: 'warn' },
    routing: { aliases: { fast: 'gpt-4o-mini' } },
  },
})
```

## Comparison

| Feature | ai-armor | LiteLLM | Portkey | AI SDK |
|---|---|---|---|---|
| Self-hosted | Yes | Yes | Partial | N/A |
| Embeddable (npm) | Yes | No (proxy) | No (service) | Yes |
| TypeScript native | Yes | No | Yes | Yes |
| Rate limiting | Yes | Yes | No | No |
| Cost tracking | Yes | Yes | Yes (SaaS) | No |
| Fallback chains | Yes | Yes | Yes | No |
| Caching | Yes | Yes | Yes | No |

## Packages

| Package | Description |
|---|---|
| [`ai-armor`](./packages/core) | Framework-agnostic core library |
| [`@ai-armor/nuxt`](./packages/nuxt) | Nuxt module with auto-imports and composables |

## Documentation

Visit [ai-armor.dev](https://ai-armor.dev) for full documentation.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](./LICENSE) -- Made by [Billy Maulana](https://github.com/billymaulana)
