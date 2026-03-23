<p align="center">
  <img src="https://raw.githubusercontent.com/billymaulana/ai-armor/main/.github/logo.png" alt="AI ARMOR" width="300" />
</p>

<h3 align="center">@ai-armor/nuxt</h3>

<p align="center">
  <strong>Nuxt module for ai-armor -- production AI toolkit with rate limiting, cost tracking, budget controls, fallback chains, caching, safety guardrails, and observability. Auto-imported composables, server middleware, and admin API routes for Nuxt 3/4.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@ai-armor/nuxt"><img src="https://img.shields.io/npm/v/@ai-armor/nuxt?color=yellow&label=npm" alt="npm version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://github.com/billymaulana/ai-armor"><img src="https://img.shields.io/github/stars/billymaulana/ai-armor?style=social" alt="GitHub stars"></a>
</p>

---

## Install

```bash
pnpm add @ai-armor/nuxt
```

## Configure

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
    adminSecret: process.env.ARMOR_ADMIN_SECRET,
  },
})
```

## Auto-Imported Composables

| Composable | Purpose |
|:---|:---|
| `useArmorCost()` | Track daily/monthly cost, budget proximity |
| `useArmorStatus()` | Health check, rate limit remaining |
| `useArmorSafety()` | Safety event tracking, block counts |

## API Routes

| Route | Description |
|:---|:---|
| `GET /api/_armor/status` | Health status, rate limit info |
| `GET /api/_armor/usage` | Cost tracking, budget utilization |
| `POST /api/_armor/safety` | Safety check for text content |

All routes protected by `adminSecret` when configured.

## Compatibility

- Nuxt 3 (>=3.0.0)
- Nuxt 4 (>=4.0.0)

## Documentation

Full docs: [billymaulana.github.io/ai-armor](https://billymaulana.github.io/ai-armor/)

## License

[MIT](https://github.com/billymaulana/ai-armor/blob/main/LICENSE) -- [Billy Maulana](https://github.com/billymaulana)
