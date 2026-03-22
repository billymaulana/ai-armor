# Logging & Observability

ai-armor provides structured logging for every AI request, giving you full visibility into costs, latency, cache performance, and usage patterns.

## Configuration

```ts
import { createArmor } from 'ai-armor'

const armor = createArmor({
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency', 'cached', 'userId'],
    maxEntries: 10000,
    onRequest: async (log) => {
      // Forward to external analytics
    },
  },
})
```

### LoggingConfig Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `enabled` | `boolean` | Yes | -- | Enable or disable logging |
| `include` | `string[]` | Yes | -- | Fields to include in filtered log output |
| `onRequest` | `function` | No | -- | Callback fired after each request is logged |
| `maxEntries` | `number` | No | `10000` | Maximum log entries kept in memory |

### Include Filter Values

| Value | Fields Included |
|---|---|
| `'model'` | `model`, `provider` |
| `'tokens'` | `inputTokens`, `outputTokens` |
| `'cost'` | `cost` |
| `'latency'` | `latency` |
| `'userId'` | `userId` (if present) |
| `'cached'` | `cached` |
| `'fallback'` | `fallback` |

The `include` filter controls what fields appear in the filtered log output. The full `ArmorLog` is always stored internally -- `include` only affects the `getFilteredLogs()` output.

## ArmorLog Fields

Every logged request produces an `ArmorLog` entry:

```ts
interface ArmorLog {
  id: string // Unique request ID (UUID)
  timestamp: number // Unix timestamp (ms)
  model: string // Model used for the request
  provider: string // Provider name (e.g., 'openai', 'anthropic')
  inputTokens: number // Prompt/input token count
  outputTokens: number // Completion/output token count
  cost: number // Calculated cost in USD
  latency: number // Request duration in milliseconds
  cached: boolean // Whether this was a cache hit
  fallback: boolean // Whether a fallback model was used
  userId?: string // User ID (if provided in context)
  blocked?: string // Block reason (if request was blocked)
  rateLimited: boolean // Whether the request was rate limited
}
```

## Logging Requests

Call `armor.log()` to record a request:

```ts
await armor.log({
  id: crypto.randomUUID(),
  timestamp: Date.now(),
  model: 'gpt-4o',
  provider: 'openai',
  inputTokens: 500,
  outputTokens: 200,
  cost: armor.estimateCost('gpt-4o', 500, 200),
  latency: 1234,
  cached: false,
  fallback: false,
  rateLimited: false,
  userId: 'user-123',
})
```

::: tip AI SDK Middleware
When using the [AI SDK integration](/integrations/ai-sdk), logging happens automatically. The middleware logs every request, including cache hits, errors, and cost calculations.
:::

## onRequest Callback

The `onRequest` callback fires after every logged request. Use it to forward logs to external analytics services:

```ts
const armor = createArmor({
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency'],
    onRequest: async (log) => {
      // Send to your analytics service
      await fetch('https://analytics.example.com/ai-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log),
      })
    },
  },
})
```

Common use cases:

```ts
// Alert on expensive requests
onRequest: async (log) => {
  if (log.cost > 0.10) {
    await sendSlackAlert(`Expensive AI request: $${log.cost.toFixed(4)} on ${log.model}`)
  }
}

// Track metrics
onRequest: async (log) => {
  metrics.increment('ai.requests', { model: log.model, provider: log.provider })
  metrics.histogram('ai.latency', log.latency, { model: log.model })
  metrics.gauge('ai.cost', log.cost, { model: log.model })
}

// Write to database
onRequest: async (log) => {
  await db.insert('ai_logs').values({
    requestId: log.id,
    model: log.model,
    cost: log.cost,
    latency: log.latency,
    userId: log.userId,
    createdAt: new Date(log.timestamp),
  })
}
```

## maxEntries

By default, ai-armor keeps the last 10,000 log entries in memory. When the limit is exceeded, oldest entries are removed:

```ts
const logging = {
  enabled: true,
  include: ['model', 'cost'],
  maxEntries: 50000, // Keep more entries for high-traffic applications
}
```

::: warning Memory Usage
Each log entry is relatively small (~200 bytes), but at 50,000 entries that is ~10 MB. For very high-traffic applications, use `onRequest` to forward logs to an external store and keep `maxEntries` lower.
:::

## getLogs()

Retrieve all stored log entries:

```ts
const logs = armor.getLogs()

// Total cost
const totalCost = logs.reduce((sum, log) => sum + log.cost, 0)
// eslint-disable-next-line no-console
console.log(`Total cost: $${totalCost.toFixed(4)}`)

// Average latency
const avgLatency = logs.reduce((sum, log) => sum + log.latency, 0) / logs.length
// eslint-disable-next-line no-console
console.log(`Avg latency: ${avgLatency.toFixed(0)}ms`)

// Cache hit rate
const cacheHits = logs.filter(l => l.cached).length
// eslint-disable-next-line no-console
console.log(`Cache hit rate: ${((cacheHits / logs.length) * 100).toFixed(1)}%`)
```

`getLogs()` returns a copy of the internal array, so you can safely modify or filter the result without affecting stored logs.

## Building a Cost Dashboard

Here is a complete example of a cost dashboard API endpoint:

```ts
import { createArmor } from 'ai-armor'
import express from 'express'

const armor = createArmor({
  budget: { daily: 200, monthly: 2000, onExceeded: 'warn' },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency', 'cached', 'userId'],
    maxEntries: 50000,
  },
})

const app = express()

app.get('/api/dashboard', (_req, res) => {
  const logs = armor.getLogs()

  // Per-provider breakdown
  const byProvider: Record<string, { count: number, cost: number, avgLatency: number }> = {}
  for (const log of logs) {
    if (!byProvider[log.provider]) {
      byProvider[log.provider] = { count: 0, cost: 0, avgLatency: 0 }
    }
    byProvider[log.provider].count++
    byProvider[log.provider].cost += log.cost
    byProvider[log.provider].avgLatency += log.latency
  }
  for (const provider of Object.values(byProvider)) {
    provider.avgLatency = Math.round(provider.avgLatency / provider.count)
    provider.cost = Number(provider.cost.toFixed(4))
  }

  // Per-model breakdown
  const byModel: Record<string, { count: number, cost: number }> = {}
  for (const log of logs) {
    if (!byModel[log.model]) {
      byModel[log.model] = { count: 0, cost: 0 }
    }
    byModel[log.model].count++
    byModel[log.model].cost += log.cost
  }

  // Top users by cost
  const byUser: Record<string, number> = {}
  for (const log of logs) {
    if (log.userId) {
      byUser[log.userId] = (byUser[log.userId] ?? 0) + log.cost
    }
  }
  const topUsers = Object.entries(byUser)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([userId, cost]) => ({ userId, cost: Number(cost.toFixed(4)) }))

  const totalCost = logs.reduce((s, l) => s + l.cost, 0)
  const cachedCount = logs.filter(l => l.cached).length

  res.json({
    summary: {
      totalRequests: logs.length,
      totalCost: Number(totalCost.toFixed(4)),
      cacheHitRate: logs.length > 0 ? Number(((cachedCount / logs.length) * 100).toFixed(1)) : 0,
      avgLatency: logs.length > 0 ? Math.round(logs.reduce((s, l) => s + l.latency, 0) / logs.length) : 0,
    },
    byProvider,
    byModel,
    topUsers,
  })
})
```

## Related

- [Cost Tracking](/guide/cost-tracking) -- Cost calculation and budgets
- [Caching](/guide/caching) -- Track cache effectiveness
- [AI SDK Integration](/integrations/ai-sdk) -- Automatic logging
- [API Reference: Types](/api/types) -- ArmorLog interface
