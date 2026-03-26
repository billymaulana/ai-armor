# Rate Limiting

ai-armor provides application-level rate limiting to protect your AI endpoints from abuse, regardless of which AI provider you use.

## How Sliding Window Works

The default strategy is **sliding window**, which provides smoother rate limiting than fixed windows. Instead of resetting counters at fixed intervals, sliding window tracks individual request timestamps and counts requests within a rolling time period.

For example, with a rule of "30 requests per 1 minute":

- At `T+0s`: request 1 recorded
- At `T+30s`: request 30 recorded (limit reached)
- At `T+45s`: request 31 is **blocked** (30 requests still within the 60s window)
- At `T+61s`: request 1 has expired from the window, so a new request is allowed

This avoids the "thundering herd" problem of fixed windows where all counters reset simultaneously.

## Basic Configuration

```ts
import { createArmor } from 'ai-armor'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [
      { key: 'user', limit: 30, window: '1m' },
    ],
  },
})
```

## Rules

Each rule defines a rate limit dimension. You can combine multiple rules -- a request must pass **all** rules to be allowed.

```ts
const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [
      { key: 'user', limit: 30, window: '1m' }, // 30 req/min per user
      { key: 'ip', limit: 100, window: '1m' }, // 100 req/min per IP
      { key: 'apiKey', limit: 500, window: '1h' }, // 500 req/hour per API key
    ],
  },
})
```

### Rule Keys

| Key | Resolved From | Description |
|---|---|---|
| `'user'` | `ctx.userId` | Per-user rate limit. Falls back to `'anonymous'` if not set. |
| `'ip'` | `ctx.ip` | Per-IP rate limit. Falls back to `'unknown'`. |
| `'apiKey'` | `ctx.apiKey` | Per-API-key rate limit. Falls back to `'unknown'`. |
| Custom string | `ctx[key]` | Any custom property on the context object. |

### Window Format

The `window` field accepts a number followed by a time unit:

| Format | Duration |
|---|---|
| `'30s'` | 30 seconds |
| `'1m'` | 1 minute |
| `'5m'` | 5 minutes |
| `'1h'` | 1 hour |
| `'24h'` | 24 hours |
| `'1d'` | 1 day |

## Checking Rate Limits

Call `checkRateLimit()` with an `ArmorContext` to check all rules:

```ts
const ctx = { userId: 'user-123', ip: '192.168.1.1' }

const result = await armor.checkRateLimit(ctx)

if (!result.allowed) {
  // Request is rate limited
  // eslint-disable-next-line no-console
  console.log(`Rate limited. Resets at: ${new Date(result.resetAt).toISOString()}`)
  // eslint-disable-next-line no-console
  console.log(`Remaining: ${result.remaining}`)
}
else {
  // Request is allowed
  // eslint-disable-next-line no-console
  console.log(`Allowed. ${result.remaining} requests remaining.`)
}
```

The return type is `RateLimitResult`:

```ts
interface RateLimitResult {
  allowed: boolean // Whether the request is allowed
  remaining: number // How many requests remain before the limit
  resetAt: number // Unix timestamp (ms) when the window resets
}
```

::: info Two-Phase Check
Rate limit checks use a two-phase approach internally. First, all rules are evaluated read-only. Only if all rules pass does the request get recorded. This prevents partial state mutation when an inner rule blocks a request.
:::

## Custom Key Resolver

For advanced use cases, you can override how rate limit keys are resolved:

```ts
const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [
      { key: 'user', limit: 60, window: '1m' },
    ],
    keyResolver: (ctx, ruleKey) => {
      if (ruleKey === 'user') {
        // Rate limit by API key instead of user ID
        return ctx.apiKey ?? ctx.userId ?? 'anonymous'
      }
      return (ctx[ruleKey] as string) ?? 'unknown'
    },
  },
})
```

This is useful when:

- You want to group users by organization or team
- You need to rate limit by a custom dimension (e.g., `tenant`, `plan`)
- You want different resolution logic per rule key

```ts
// Rate limit by tenant, falling back to user
keyResolver: (ctx, ruleKey) => {
  if (ruleKey === 'user') {
    return (ctx.tenantId as string) ?? ctx.userId ?? 'anonymous'
  }
  return (ctx[ruleKey] as string) ?? 'unknown'
}
```

## onLimited Callback

React when a request is rate limited:

```ts
const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 30, window: '1m' }],
    onLimited: (ctx) => {
      console.warn(`[rate-limit] User ${ctx.userId} exceeded rate limit`)
      // Send to monitoring, increment metrics, alert, etc.
    },
  },
})
```

The callback fires synchronously when a rate limit check fails. Use it for logging, metrics, or alerting -- not for modifying the result.

## External Storage (Redis)

By default, rate limit state is stored in-memory (per-process). For multi-instance deployments, pass a `StorageAdapter` to share state across all server instances:

```ts
import { createArmor, createRedisAdapter } from 'ai-armor'
import Redis from 'ioredis'

const redis = new Redis()

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 100, window: '1m' }],
    store: createRedisAdapter(redis),
  },
})
```

::: warning
Passing `store: 'redis'` as a string will throw an error. You must provide a concrete `StorageAdapter` instance. The string value exists for future built-in adapter support.
:::

## Patterns

### Per-User + Global Limit

Protect against both individual abuse and overall system load:

```ts
const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [
      { key: 'user', limit: 30, window: '1m' }, // Per-user
      { key: 'ip', limit: 100, window: '1m' }, // Per-IP (catches shared IPs)
      { key: 'apiKey', limit: 1000, window: '1h' }, // Per-API-key (global cap)
    ],
  },
})
```

### Tiered Rate Limits with Custom Keys

Different limits for different user plans:

```ts
const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 100, window: '1m' }],
    keyResolver: (ctx, ruleKey) => {
      if (ruleKey === 'user') {
        // Prefix with plan tier so each tier has its own counter
        const plan = (ctx.plan as string) ?? 'free'
        return `${plan}:${ctx.userId ?? 'anon'}`
      }
      return (ctx[ruleKey] as string) ?? 'unknown'
    },
  },
})

// Free users: 100 req/min (shared counter with "free:" prefix)
// Pro users: 100 req/min (separate counter with "pro:" prefix)
// Each counter is independent, so pro users are never affected by free user traffic
```

### HTTP Middleware with Rate Limit Headers

When using `createArmorHandler`, rate limit headers are set automatically:

```ts
import { createArmorHandler } from 'ai-armor/http'

const handler = createArmorHandler(armor)
// Sets these headers on every response:
// X-RateLimit-Remaining: <number>
// X-RateLimit-Reset: <unix timestamp>
// Retry-After: <seconds> (only on 429 responses)
```

## Related

- [Cost Tracking](/guide/cost-tracking) -- Budget controls work alongside rate limiting
- [Safety](/guide/safety) -- Additional request validation
- [AI SDK Integration](/integrations/ai-sdk) -- Rate limiting via middleware
- [API Reference: createArmor](/api/create-armor) -- Full configuration options
