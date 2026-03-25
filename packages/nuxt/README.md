<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/billymaulana/ai-armor/main/.github/logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/billymaulana/ai-armor/main/.github/logo-light.svg">
    <img src="https://raw.githubusercontent.com/billymaulana/ai-armor/main/.github/logo-dark.svg" alt="AI ARMOR" width="160" />
  </picture>
</p>

<h3 align="center">@ai-armor/nuxt</h3>

<p align="center">
  Nuxt module for <a href="https://github.com/billymaulana/ai-armor">ai-armor</a> -- production AI toolkit with rate limiting, cost tracking, budget controls, fallback chains, caching, safety guardrails, and observability.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@ai-armor/nuxt"><img src="https://img.shields.io/npm/v/@ai-armor/nuxt?color=22d3ee&label=npm" alt="npm version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://nuxt.com/modules/ai-armor"><img src="https://img.shields.io/badge/Nuxt-Module-00DC82?logo=nuxt.js" alt="Nuxt Module"></a>
  <a href="https://github.com/billymaulana/ai-armor"><img src="https://img.shields.io/github/stars/billymaulana/ai-armor?style=social" alt="GitHub stars"></a>
</p>

---

## Features

- **Rate Limiting** -- Sliding window, fixed window, or token bucket per IP/user/key
- **Cost Tracking** -- Real-time daily/monthly spend with budget alerts
- **Safety Guardrails** -- Prompt injection detection, PII filtering, content moderation
- **Auto-Imported Composables** -- `useArmorCost()`, `useArmorStatus()`, `useArmorSafety()`
- **Server API Routes** -- Admin endpoints for monitoring and safety checks
- **Zero Config** -- Works out of the box with sensible defaults
- **TypeScript First** -- Full type safety with auto-generated types

## Quick Setup

Install the module:

```bash
npx nuxi module add @ai-armor/nuxt
```

Or manually:

```bash
pnpm add @ai-armor/nuxt ai-armor
```

Add to `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ['@ai-armor/nuxt'],

  aiArmor: {
    rateLimit: {
      strategy: 'sliding-window',
      rules: [{ key: 'ip', limit: 30, window: '1m' }],
    },
    budget: { daily: 50, monthly: 500, onExceeded: 'warn' },
    safety: { promptInjection: true, piiDetection: true },
    adminSecret: process.env.ARMOR_ADMIN_SECRET,
  },
})
```

## Composables

| Composable | Purpose |
|:---|:---|
| `useArmorCost()` | Track daily/monthly cost, budget proximity |
| `useArmorStatus()` | Health check, rate limit remaining |
| `useArmorSafety()` | Safety event tracking, block counts |

All composables are auto-imported -- no import statements needed.

## Server API Routes

| Route | Description |
|:---|:---|
| `GET /api/_armor/status` | Health status, rate limit info |
| `GET /api/_armor/usage` | Cost tracking, budget utilization |
| `POST /api/_armor/safety` | Safety check for text content |

All routes protected by `adminSecret` when configured.

## Server-Side Usage

Access the armor instance in server routes:

```ts
// server/api/chat.post.ts
export default defineEventHandler(async (event) => {
  const armor = useArmor()
  const result = await armor.invoke('openai:gpt-4o', {
    messages: [{ role: 'user', content: 'Hello' }],
  })
  return result
})
```

## Compatibility

- Nuxt 3 (>=3.0.0)
- Nuxt 4 (>=4.0.0)
- Node.js >= 18

## Documentation

Full documentation: [billymaulana.github.io/ai-armor](https://billymaulana.github.io/ai-armor/)

- [Getting Started](https://billymaulana.github.io/ai-armor/guide/getting-started)
- [Nuxt Integration Guide](https://billymaulana.github.io/ai-armor/integrations/nuxt)
- [API Reference](https://billymaulana.github.io/ai-armor/api/create-armor)

## License

[MIT](https://github.com/billymaulana/ai-armor/blob/main/LICENSE) -- [Billy Maulana](https://github.com/billymaulana)
