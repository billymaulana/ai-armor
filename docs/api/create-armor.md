# API Reference: createArmor

The main entry point for ai-armor. Creates an `ArmorInstance` with all configured protections.

## Import

```ts
import { createArmor } from 'ai-armor'
```

## Signature

```ts
function createArmor(config: ArmorConfig): ArmorInstance
```

## Parameters

### config: ArmorConfig

Every field on `ArmorConfig` is optional. Only configure the features you need.

```ts
interface ArmorConfig {
  rateLimit?: RateLimitConfig
  budget?: BudgetConfig
  fallback?: FallbackConfig
  cache?: CacheConfig
  routing?: RoutingConfig
  safety?: SafetyConfig
  logging?: LoggingConfig
}
```

---

### rateLimit: RateLimitConfig

| Field | Type | Required | Description |
|---|---|---|---|
| `strategy` | `'sliding-window' \| 'fixed-window' \| 'token-bucket'` | Yes | Rate limiting algorithm |
| `rules` | `RateLimitRule[]` | Yes | Array of rate limit rules |
| `store` | `'memory' \| 'redis' \| StorageAdapter` | No | Storage backend. Default: in-memory |
| `keyResolver` | `(ctx: ArmorContext, ruleKey: string) => string` | No | Custom key resolution |
| `onLimited` | `(ctx: ArmorContext) => void` | No | Callback when rate limited |

**RateLimitRule:**

| Field | Type | Description |
|---|---|---|
| `key` | `'user' \| 'ip' \| 'apiKey' \| string` | Dimension to rate limit by |
| `limit` | `number` | Maximum requests in the window |
| `window` | `string` | Time window (e.g., `'1m'`, `'1h'`, `'30s'`, `'1d'`) |

See [Rate Limiting guide](/guide/rate-limiting) for details.

---

### budget: BudgetConfig

| Field | Type | Required | Description |
|---|---|---|---|
| `daily` | `number` | No | Maximum daily spend in USD |
| `monthly` | `number` | No | Maximum monthly spend in USD |
| `perUser` | `number` | No | Maximum daily spend per user in USD |
| `onExceeded` | `'block' \| 'warn' \| 'downgrade-model'` | Yes | Action when budget exceeded |
| `downgradeMap` | `Record<string, string>` | No | Model downgrade mapping |
| `store` | `'memory' \| 'redis' \| StorageAdapter` | No | Storage backend. Default: in-memory |
| `onWarned` | `(ctx: ArmorContext, budget: { daily: number, monthly: number, perUserDaily?: number }) => void` | No | Callback when budget warning fires |

See [Cost Tracking guide](/guide/cost-tracking) for details.

---

### fallback: FallbackConfig

| Field | Type | Required | Description |
|---|---|---|---|
| `chains` | `Record<string, string[]>` | Yes | Fallback model chains per primary model |
| `timeout` | `number` | No | Request timeout in ms before triggering fallback |
| `retries` | `number` | No | Number of retries before moving to next in chain |
| `backoff` | `'exponential' \| 'linear'` | No | Backoff strategy between retries |
| `healthCheck` | `boolean` | No | Enable passive health checking |

---

### cache: CacheConfig

| Field | Type | Required | Description |
|---|---|---|---|
| `enabled` | `boolean` | Yes | Enable/disable caching |
| `strategy` | `'exact'` | Yes | Cache matching strategy |
| `ttl` | `number` | Yes | Time-to-live in seconds |
| `driver` | `string` | Yes | Storage driver (e.g., `'memory'`) |
| `maxSize` | `number` | No | Maximum entries (LRU eviction) |
| `keyFn` | `(request: ArmorRequest) => string` | No | Custom cache key generator |

See [Caching guide](/guide/caching) for details.

---

### routing: RoutingConfig

| Field | Type | Required | Description |
|---|---|---|---|
| `aliases` | `Record<string, string>` | Yes | Map of alias to real model name |

See [Model Routing guide](/guide/model-routing) for details.

---

### safety: SafetyConfig

| Field | Type | Required | Description |
|---|---|---|---|
| `promptInjection` | `boolean` | No | Enable prompt injection detection |
| `piiDetection` | `boolean` | No | Enable PII detection |
| `maxTokensPerRequest` | `number` | No | Maximum tokens per request |
| `blockedPatterns` | `RegExp[]` | No | Patterns that block matching content |
| `onBlocked` | `(ctx: ArmorContext, reason: string) => void` | No | Callback when request is blocked |

See [Safety guide](/guide/safety) for details.

---

### logging: LoggingConfig

| Field | Type | Required | Description |
|---|---|---|---|
| `enabled` | `boolean` | Yes | Enable/disable logging |
| `include` | `Array<'model' \| 'tokens' \| 'cost' \| 'latency' \| 'userId' \| 'cached' \| 'fallback'>` | Yes | Fields to include |
| `onRequest` | `(log: ArmorLog) => void \| Promise<void>` | No | Callback after each logged request |
| `maxEntries` | `number` | No | Max entries in memory. Default: `10000` |

See [Logging guide](/guide/logging) for details.

---

## Return Type: ArmorInstance

```ts
interface ArmorInstance {
  config: ArmorConfig
  checkRateLimit: (ctx: ArmorContext) => Promise<RateLimitResult>
  trackCost: (model: string, inputTokens: number, outputTokens: number, userId?: string) => Promise<void>
  checkBudget: (model: string, ctx: ArmorContext) => Promise<{ allowed: boolean, action: string, suggestedModel?: string }>
  resolveModel: (model: string) => string
  getCachedResponse: (request: ArmorRequest) => unknown | undefined
  setCachedResponse: (request: ArmorRequest, response: unknown) => void
  log: (entry: ArmorLog) => Promise<void>
  getLogs: () => ArmorLog[]
  estimateCost: (model: string, inputTokens: number, outputTokens: number) => number
}
```

---

## Methods

### checkRateLimit(ctx)

Check all configured rate limit rules for the given context.

```ts
const result = await armor.checkRateLimit({
  userId: 'user-123',
  ip: '192.168.1.1',
})
```

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `ctx` | `ArmorContext` | Request context with user/IP/API key info |

**Returns:** `Promise<RateLimitResult>`

```ts
interface RateLimitResult {
  allowed: boolean // true if request can proceed
  remaining: number // requests remaining before limit
  resetAt: number // Unix timestamp (ms) when window resets
}
```

If no rate limit is configured, returns `{ allowed: true, remaining: Infinity, resetAt: 0 }`.

---

### trackCost(model, inputTokens, outputTokens, userId?)

Record token usage for budget tracking. Looks up the model in the pricing database and stores the calculated cost.

```ts
await armor.trackCost('gpt-4o', 500, 200, 'user-123')
```

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `model` | `string` | Model name (must match pricing database) |
| `inputTokens` | `number` | Number of input/prompt tokens |
| `outputTokens` | `number` | Number of output/completion tokens |
| `userId` | `string?` | Optional user ID for per-user tracking |

**Returns:** `Promise<void>`

No-op if `budget` is not configured.

---

### checkBudget(model, ctx)

Check if the current spend is within budget limits.

```ts
const result = await armor.checkBudget('gpt-4o', { userId: 'user-123' })
if (!result.allowed) {
  throw new Error(`Budget exceeded: ${result.action}`)
}
const finalModel = result.suggestedModel ?? 'gpt-4o'
```

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `model` | `string` | Model to check budget for |
| `ctx` | `ArmorContext` | Request context (needs `userId` for per-user checks) |

**Returns:** `Promise<{ allowed: boolean, action: string, suggestedModel?: string }>`

| Field | Description |
|---|---|
| `allowed` | `true` if request can proceed |
| `action` | `'pass'`, `'block'`, `'warn'`, or `'downgrade-model'` |
| `suggestedModel` | Cheaper model to use (only when action is `'downgrade-model'`) |

If no budget is configured, returns `{ allowed: true, action: 'pass' }`.

---

### resolveModel(model)

Resolve a model alias to its real model name.

```ts
const real = armor.resolveModel('fast')
// => 'gpt-4o-mini' (if alias configured)

const passthrough = armor.resolveModel('gpt-4o')
// => 'gpt-4o' (not an alias, returned as-is)
```

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `model` | `string` | Model name or alias |

**Returns:** `string`

---

### getCachedResponse(request)

Look up a cached response for the given request.

```ts
const request = {
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
}
const cached = armor.getCachedResponse(request)
if (cached) {
  return cached // Skip API call
}
```

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `request` | `ArmorRequest` | Request to look up |

**Returns:** `unknown | undefined` -- The cached response, or `undefined` on cache miss.

---

### setCachedResponse(request, response)

Store a response in the cache.

```ts
armor.setCachedResponse(request, response)
```

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `request` | `ArmorRequest` | The request key |
| `response` | `unknown` | The response to cache |

**Returns:** `void`

---

### log(entry)

Record a log entry.

```ts
await armor.log({
  id: crypto.randomUUID(),
  timestamp: Date.now(),
  model: 'gpt-4o',
  provider: 'openai',
  inputTokens: 500,
  outputTokens: 200,
  cost: 0.00325,
  latency: 1234,
  cached: false,
  fallback: false,
  rateLimited: false,
  userId: 'user-123',
})
```

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `entry` | `ArmorLog` | Full log entry |

**Returns:** `Promise<void>`

---

### getLogs()

Retrieve all stored log entries.

```ts
const logs = armor.getLogs()
const totalCost = logs.reduce((sum, l) => sum + l.cost, 0)
```

**Returns:** `ArmorLog[]` -- A copy of all stored log entries.

---

### estimateCost(model, inputTokens, outputTokens)

Calculate the estimated cost for a request without tracking it.

```ts
const cost = armor.estimateCost('gpt-4o', 1000, 500)
// eslint-disable-next-line no-console
console.log(`Estimated: $${cost.toFixed(6)}`)
```

**Parameters:**

| Name | Type | Description |
|---|---|---|
| `model` | `string` | Model name |
| `inputTokens` | `number` | Number of input tokens |
| `outputTokens` | `number` | Number of output tokens |

**Returns:** `number` -- Cost in USD. Returns `0` if model is not in the pricing database.

---

## Additional Exports

The `ai-armor` package also exports these pricing utilities:

```ts
import {
  calculateCost,
  getAllModels,
  getModelPricing,
  getProvider,
} from 'ai-armor'
```

| Function | Signature | Description |
|---|---|---|
| `calculateCost` | `(model: string, inputTokens: number, outputTokens: number) => number` | Calculate cost in USD |
| `getModelPricing` | `(model: string) => ModelPricing \| undefined` | Get pricing info for a model |
| `getAllModels` | `() => string[]` | List all models in the pricing database |
| `getProvider` | `(model: string) => string` | Get the provider name for a model |

## Related

- [Types Reference](/api/types) -- All interface definitions
- [AI SDK Integration](/integrations/ai-sdk) -- Middleware adapter
- [Getting Started](/guide/getting-started) -- Quick start guide
