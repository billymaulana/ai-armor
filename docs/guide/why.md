# Why ai-armor?

## The Problem

Building AI-powered applications in production means dealing with problems that don't exist in prototypes:

- **Cost spirals** -- A single misconfigured loop can burn through $1,000 in minutes. Without per-user budgets, one power user can exhaust your entire API allocation.
- **No rate limiting** -- AI provider rate limits are per-API-key, not per-user. You need application-level rate limiting to protect your service.
- **Zero observability** -- You have no idea which models cost the most, which users are heaviest, or whether your cache is actually saving money.
- **Safety gaps** -- Prompt injection, PII leakage, and runaway token counts are real attack vectors in production AI systems.

Every team ends up building these guardrails from scratch. The result is thousands of lines of bespoke infrastructure code that is hard to test, easy to get wrong, and impossible to share across projects.

## The Solution

ai-armor is a single TypeScript package that handles all of these concerns:

```ts
import { createArmor } from 'ai-armor'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 30, window: '1m' }],
  },
  budget: {
    daily: 50,
    monthly: 500,
    perUser: 10,
    onExceeded: 'downgrade-model',
    downgradeMap: { 'gpt-4o': 'gpt-4o-mini' },
  },
  cache: {
    enabled: true,
    strategy: 'exact',
    ttl: 3600,
  },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency'],
  },
})
```

One configuration object. All guardrails active. Works with any AI provider, any framework, any runtime.

## Comparison

| Feature | ai-armor | Build from scratch | LiteLLM (Python) |
|---|---|---|---|
| Language | TypeScript-native | Your language | Python |
| Rate limiting | Sliding window | Must implement | Basic |
| Cost tracking | 69 models, auto pricing | Manual pricing table | Yes |
| Budget controls | Daily/monthly/per-user + auto downgrade | Must implement | Basic |
| Response caching | O(1) LRU with TTL | Must implement | Redis required |
| Safety guardrails | Prompt injection, PII, token limits | Must implement | No |
| Model routing | Aliases + tier-based routing | Must implement | Yes |
| Logging | Structured logs with callbacks | Must implement | Yes |
| AI SDK integration | First-class middleware | N/A | N/A |
| Nuxt module | `@ai-armor/nuxt` | N/A | N/A |
| Setup time | 5 minutes | Days/weeks | 30 minutes |
| Dependencies | 1 (gpt-tokenizer) | Many | Heavy |

## Key Differentiators

### TypeScript-native

ai-armor is written in strict TypeScript with full type inference. Every configuration option, every callback, every return type is fully typed. No `any`, no runtime surprises.

```ts
// Full IntelliSense for all config options
const armor = createArmor({
  budget: {
    daily: 50,
    onExceeded: 'downgrade-model', // autocomplete: 'block' | 'warn' | 'downgrade-model'
    downgradeMap: {
      'gpt-4o': 'gpt-4o-mini',
    },
  },
})

// Return types are fully typed
const result = await armor.checkBudget('gpt-4o', { userId: 'user-1' })
// result.allowed: boolean
// result.action: string
// result.suggestedModel?: string
```

### Framework-agnostic

ai-armor works with any TypeScript project. Use it directly with provider SDKs, as Vercel AI SDK middleware, or as HTTP middleware for Express/Hono/Fastify:

- **Direct SDK** -- Call `armor.checkRateLimit()`, `armor.trackCost()`, etc. manually
- **AI SDK middleware** -- `wrapLanguageModel()` with automatic protection
- **HTTP middleware** -- `createArmorHandler()` for any Connect-compatible server

### Zero-config defaults

Every feature is opt-in. Start with just rate limiting, add cost tracking later, enable caching when you need it. Sensible defaults mean you don't need to configure everything upfront.

### Minimal dependencies

The core package depends only on `gpt-tokenizer` (token counting). No heavy frameworks, no runtime bloat.

## Next Steps

- [Getting Started](/guide/getting-started) -- Install and configure in 5 minutes
- [Rate Limiting](/guide/rate-limiting) -- Protect your endpoints
- [Cost Tracking](/guide/cost-tracking) -- Track and control spending
- [AI SDK Integration](/integrations/ai-sdk) -- Use with Vercel AI SDK
