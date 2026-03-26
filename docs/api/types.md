# Types Reference

All TypeScript interfaces exported by ai-armor.

## Import

```ts
import type {
  ArmorConfig,
  ArmorContext,
  ArmorInstance,
  ArmorLog,
  ArmorRequest,
  BudgetConfig,
  CacheConfig,
  ExactCacheConfig,
  FallbackConfig,
  FallbackResult,
  LoggingConfig,
  RateLimitConfig,
  RateLimitResult,
  RateLimitRule,
  RoutingConfig,
  SafetyCheckResult,
  SafetyConfig,
  SemanticCacheConfig,
  StorageAdapter,
} from 'ai-armor'
```

---

## ArmorConfig {#armorconfig}

Top-level configuration object passed to `createArmor()`. All fields are optional -- only configure the features you need.

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

| Field | Type | Description |
|---|---|---|
| `rateLimit` | [`RateLimitConfig`](#ratelimitconfig) | Rate limiting configuration |
| `budget` | [`BudgetConfig`](#budgetconfig) | Cost tracking and budget configuration |
| `fallback` | [`FallbackConfig`](#fallbackconfig) | Fallback chain configuration |
| `cache` | [`CacheConfig`](#cacheconfig) | Response caching configuration |
| `routing` | [`RoutingConfig`](#routingconfig) | Model alias routing configuration |
| `safety` | [`SafetyConfig`](#safetyconfig) | Safety guardrails configuration |
| `logging` | [`LoggingConfig`](#loggingconfig) | Logging and observability configuration |

---

## RateLimitConfig {#ratelimitconfig}

Configuration for rate limiting.

```ts
interface RateLimitConfig {
  strategy: 'sliding-window'
  rules: RateLimitRule[]
  store?: 'memory' | 'redis' | StorageAdapter
  keyResolver?: (ctx: ArmorContext, ruleKey: string) => string
  onLimited?: (ctx: ArmorContext) => void
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `strategy` | `'sliding-window'` | Yes | Rate limiting algorithm. Currently `'sliding-window'` is fully implemented. |
| `rules` | [`RateLimitRule[]`](#ratelimitrule) | Yes | Array of rate limit rules. All rules must pass for a request to be allowed. |
| `store` | `'memory' \| 'redis' \| StorageAdapter` | No | Storage backend. Default: in-memory. Pass a [`StorageAdapter`](#storageadapter) for shared state across instances. |
| `keyResolver` | `(ctx: ArmorContext, ruleKey: string) => string` | No | Custom function to resolve rate limit keys from context. Overrides default key resolution. |
| `onLimited` | `(ctx: ArmorContext) => void` | No | Callback fired synchronously when a request is rate limited. |

---

## RateLimitRule {#ratelimitrule}

A single rate limit rule defining a dimension, limit, and time window.

```ts
interface RateLimitRule {
  key: 'user' | 'ip' | 'apiKey' | (string & {})
  limit: number
  window: string
}
```

| Field | Type | Description |
|---|---|---|
| `key` | `'user' \| 'ip' \| 'apiKey' \| string` | Dimension to rate limit by. Built-in keys resolve from `ArmorContext` fields. Custom strings resolve from `ctx[key]`. |
| `limit` | `number` | Maximum number of requests allowed within the window. |
| `window` | `string` | Time window duration. Format: number + unit (`s` for seconds, `m` for minutes, `h` for hours, `d` for days). Examples: `'30s'`, `'1m'`, `'1h'`, `'24h'`, `'1d'`. |

---

## RateLimitResult {#ratelimitresult}

Result returned by `armor.checkRateLimit()`.

```ts
interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}
```

| Field | Type | Description |
|---|---|---|
| `allowed` | `boolean` | `true` if the request is within all rate limits. |
| `remaining` | `number` | Number of requests remaining before the most restrictive rule is hit. |
| `resetAt` | `number` | Unix timestamp (milliseconds) when the earliest rate limit window resets. `0` if no rate limit is configured. |

---

## BudgetConfig {#budgetconfig}

Configuration for cost tracking and budget enforcement.

```ts
interface BudgetConfig {
  daily?: number
  monthly?: number
  perUser?: number
  perUserMonthly?: number
  onExceeded: 'block' | 'warn' | 'downgrade-model'
  downgradeMap?: Record<string, string>
  store?: 'memory' | 'redis' | StorageAdapter
  onWarned?: (ctx: ArmorContext, budget: {
    daily: number
    monthly: number
    perUserDaily?: number
    perUserMonthly?: number
  }) => void
  onUnknownModel?: (model: string) => void
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `daily` | `number` | No | Maximum daily spend in USD. Resets at midnight (server local time). |
| `monthly` | `number` | No | Maximum monthly spend in USD. Resets on the 1st of each month. |
| `perUser` | `number` | No | Maximum daily spend per user in USD. Requires `ctx.userId` to be set. |
| `perUserMonthly` | `number` | No | Maximum monthly spend per user in USD. Requires `ctx.userId` to be set. |
| `onExceeded` | `'block' \| 'warn' \| 'downgrade-model'` | Yes | Action to take when a budget limit is exceeded. |
| `downgradeMap` | `Record<string, string>` | No | Maps expensive models to cheaper alternatives. Used when `onExceeded` is `'downgrade-model'`. |
| `store` | `'memory' \| 'redis' \| StorageAdapter` | No | Storage backend for cost data. Default: in-memory. |
| `onWarned` | `function` | No | Callback fired when `onExceeded` is `'warn'` and a budget is exceeded. Receives current spend totals including `perUserMonthly`. |
| `onUnknownModel` | `(model: string) => void` | No | Callback fired when a model is not found in the pricing table. |

---

## FallbackConfig {#fallbackconfig}

Configuration for fallback chains.

```ts
interface FallbackConfig {
  chains: Record<string, string[]>
  timeout?: number
  retries?: number
  backoff?: 'exponential' | 'linear'
  healthCheck?: boolean
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `chains` | `Record<string, string[]>` | Yes | Maps primary model to ordered list of fallback models. |
| `timeout` | `number` | No | Request timeout in milliseconds before triggering fallback. |
| `retries` | `number` | No | Number of retries per model before moving to next in chain. |
| `backoff` | `'exponential' \| 'linear'` | No | Backoff strategy between retries. |
| `healthCheck` | `boolean` | No | Enable passive health checking for automatic recovery. |

---

## CacheConfig {#cacheconfig}

Configuration for response caching. This is a union type -- use `strategy: 'exact'` for exact-match caching or `strategy: 'semantic'` for embedding-based similarity caching.

```ts
type CacheConfig = ExactCacheConfig | SemanticCacheConfig
```

### ExactCacheConfig {#exactcacheconfig}

```ts
interface ExactCacheConfig {
  enabled: boolean
  strategy: 'exact'
  ttl: number
  maxSize?: number
  keyFn?: (request: ArmorRequest) => string
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `enabled` | `boolean` | Yes | Enable or disable caching. |
| `strategy` | `'exact'` | Yes | Exact-match cache strategy. |
| `ttl` | `number` | Yes | Time-to-live for cache entries, in seconds. |
| `maxSize` | `number` | No | Maximum number of cache entries. When exceeded, LRU entries are evicted. |
| `keyFn` | `(request: ArmorRequest) => string` | No | Custom function to generate cache keys. Default serializes model + messages + temperature + tools. |

### SemanticCacheConfig {#semanticcacheconfig}

```ts
interface SemanticCacheConfig {
  enabled: boolean
  strategy: 'semantic'
  ttl: number
  maxSize?: number
  embeddingFn: (text: string) => Promise<number[]>
  similarityThreshold?: number
  keyFn?: (request: ArmorRequest) => string
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `enabled` | `boolean` | Yes | Enable or disable caching. |
| `strategy` | `'semantic'` | Yes | Semantic similarity cache strategy. |
| `ttl` | `number` | Yes | Time-to-live for cache entries, in seconds. |
| `maxSize` | `number` | No | Maximum number of cache entries. When exceeded, LRU entries are evicted. |
| `embeddingFn` | `(text: string) => Promise<number[]>` | Yes | Function that returns an embedding vector for the given text. Used for similarity comparison. |
| `similarityThreshold` | `number` | No | Minimum cosine similarity (0-1) to consider a cache hit. Default: `0.92`. |
| `keyFn` | `(request: ArmorRequest) => string` | No | Custom function to generate cache keys. Default serializes model + messages + temperature + tools. |

---

## RoutingConfig {#routingconfig}

Configuration for model alias routing.

```ts
interface RoutingConfig {
  aliases: Record<string, string>
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `aliases` | `Record<string, string>` | Yes | Maps alias names to real model names. Example: `{ fast: 'gpt-4o-mini', best: 'claude-opus-4-20250514' }` |

---

## SafetyConfig {#safetyconfig}

Configuration for safety guardrails.

```ts
interface SafetyConfig {
  promptInjection?: boolean
  piiDetection?: boolean
  maxTokensPerRequest?: number
  blockedPatterns?: RegExp[]
  onBlocked?: (ctx: ArmorContext, reason: string) => void
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `promptInjection` | `boolean` | No | Enable detection of common prompt injection patterns. |
| `piiDetection` | `boolean` | No | Enable detection of PII (email, phone, SSN, credit card). |
| `maxTokensPerRequest` | `number` | No | Maximum total tokens allowed per request. |
| `blockedPatterns` | `RegExp[]` | No | Custom regex patterns that block matching request content. |
| `onBlocked` | `(ctx: ArmorContext, reason: string) => void` | No | Callback fired when a request is blocked by a safety check. |

---

## LoggingConfig {#loggingconfig}

Configuration for logging and observability.

```ts
interface LoggingConfig {
  enabled: boolean
  include: Array<'model' | 'tokens' | 'cost' | 'latency' | 'userId' | 'cached' | 'fallback'>
  onRequest?: (log: ArmorLog) => void | Promise<void>
  maxEntries?: number
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `enabled` | `boolean` | Yes | Enable or disable logging. |
| `include` | `Array` | Yes | Fields to include in filtered log output. `id` and `timestamp` are always included. |
| `onRequest` | `(log: ArmorLog) => void \| Promise<void>` | No | Async callback fired after each request is logged. Use for external analytics. |
| `maxEntries` | `number` | No | Maximum log entries to keep in memory. Default: `10000`. Oldest entries are removed when exceeded. |

---

## ArmorContext {#armorcontext}

Context object passed to rate limit checks, budget checks, and callbacks. Represents the identity and metadata of the current request.

```ts
interface ArmorContext {
  userId?: string
  ip?: string
  apiKey?: string
  headers?: Record<string, string>
  model?: string
  [key: string]: unknown
}
```

| Field | Type | Description |
|---|---|---|
| `userId` | `string?` | User identifier. Used for per-user rate limits and per-user budgets. |
| `ip` | `string?` | Client IP address. Used for IP-based rate limiting. |
| `apiKey` | `string?` | API key. Used for per-key rate limiting. |
| `headers` | `Record<string, string>?` | HTTP headers from the request. |
| `model` | `string?` | Model name (set by some integrations). |
| `[key: string]` | `unknown` | Extensible -- add any custom properties for use in `keyResolver` or callbacks. |

---

## ArmorRequest {#armorrequest}

Represents an AI API request for caching and safety checks.

```ts
interface ArmorRequest {
  model: string
  messages: unknown[]
  temperature?: number
  tools?: unknown[]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `model` | `string` | Yes | Model name (after alias resolution). |
| `messages` | `unknown[]` | Yes | Array of chat messages. |
| `temperature` | `number` | No | Sampling temperature. |
| `tools` | `unknown[]` | No | Tool/function definitions. |

---

## ArmorLog {#armorlog}

Structured log entry for each AI request.

```ts
interface ArmorLog {
  id: string
  timestamp: number
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  cost: number
  latency: number
  cached: boolean
  fallback: boolean
  userId?: string
  blocked?: string
  rateLimited: boolean
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique request identifier (UUID). |
| `timestamp` | `number` | Unix timestamp in milliseconds. |
| `model` | `string` | Model used for this request. |
| `provider` | `string` | Provider name (e.g., `'openai'`, `'anthropic'`, `'google'`). |
| `inputTokens` | `number` | Number of input/prompt tokens. |
| `outputTokens` | `number` | Number of output/completion tokens. |
| `cost` | `number` | Calculated cost in USD. |
| `latency` | `number` | Request duration in milliseconds. |
| `cached` | `boolean` | `true` if this was served from cache. |
| `fallback` | `boolean` | `true` if a fallback model was used. |
| `userId` | `string?` | User ID if provided in context. |
| `blocked` | `string?` | Reason the request was blocked (error message or safety reason). |
| `rateLimited` | `boolean` | `true` if this request was rate limited. |

---

## ArmorInstance {#armorinstance}

The object returned by `createArmor()`. Contains all configured protections and methods.

```ts
interface ArmorInstance {
  config: ArmorConfig
  checkRateLimit: (ctx: ArmorContext) => Promise<RateLimitResult>
  peekRateLimit: (ctx: ArmorContext) => Promise<{ remaining: number, resetAt: number }>
  trackCost: (model: string, inputTokens: number, outputTokens: number, userId?: string) => Promise<void>
  checkBudget: (model: string, ctx: ArmorContext) => Promise<{ allowed: boolean, action: string, suggestedModel?: string }>
  getDailyCost: (userId?: string) => Promise<number>
  getMonthlyCost: (userId?: string) => Promise<number>
  resolveModel: (model: string) => string
  getCachedResponse: (request: ArmorRequest) => Promise<unknown | undefined>
  setCachedResponse: (request: ArmorRequest, response: unknown) => Promise<void>
  log: (entry: ArmorLog) => Promise<void>
  getLogs: () => ArmorLog[]
  estimateCost: (model: string, inputTokens: number, outputTokens: number) => number
  getProvider: (model: string) => string
  checkSafety: (request: ArmorRequest, ctx: ArmorContext) => SafetyCheckResult
  executeFallback: <T>(request: ArmorRequest, handler: (model: string) => Promise<T>) => Promise<FallbackResult<T>>
}
```

See [createArmor API Reference](/api/create-armor#methods) for detailed method documentation.

---

## SafetyCheckResult {#safetycheckresult}

Result from `armor.checkSafety()`.

```ts
interface SafetyCheckResult {
  allowed: boolean
  blocked: boolean
  reason: string | null
  details: string[]
}
```

| Field | Type | Description |
|---|---|---|
| `allowed` | `boolean` | `true` if the request passed all safety checks. |
| `blocked` | `boolean` | `true` if the request was blocked. |
| `reason` | `string \| null` | Primary reason for blocking, or `null` if allowed. |
| `details` | `string[]` | Array of all triggered safety check details. |

---

## FallbackResult {#fallbackresult}

Result from `armor.executeFallback()`.

```ts
interface FallbackResult<T = unknown> {
  result: T
  model: string
  attempts: number
  fallbackUsed: boolean
}
```

| Field | Type | Description |
|---|---|---|
| `result` | `T` | The response from the successful model call. |
| `model` | `string` | The model that ultimately succeeded. |
| `attempts` | `number` | Total number of attempts made. |
| `fallbackUsed` | `boolean` | `true` if a fallback model was used instead of the primary. |

---

## StorageAdapter {#storageadapter}

Interface for custom storage backends (e.g., Redis, database). Used by rate limiting and budget tracking for shared state across multiple server instances.

```ts
interface StorageAdapter {
  getItem: (key: string) => Promise<unknown>
  setItem: (key: string, value: unknown) => Promise<void>
  removeItem: (key: string) => Promise<void>
}
```

| Method | Description |
|---|---|
| `getItem(key)` | Retrieve a value by key. Return `null` or `undefined` if not found. |
| `setItem(key, value)` | Store a value. The value is always JSON-serializable. |
| `removeItem(key)` | Delete a value by key. |

**Example implementation (Redis):**

```ts
import { createArmor, createRedisAdapter } from 'ai-armor'
import Redis from 'ioredis'

const redis = new Redis()

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 100, window: '1m' }],
    store: createRedisAdapter(redis, { prefix: 'armor:', ttl: 86400 }),
  },
})
```

---

## ModelPricing {#modelpricing}

Pricing information for a single model. Exported from `ai-armor`.

```ts
interface ModelPricing {
  model: string // Model identifier
  provider: string // Provider name
  input: number // USD per 1M input tokens
  output: number // USD per 1M output tokens
}
```

```ts
import type { ModelPricing } from 'ai-armor'
import { getModelPricing } from 'ai-armor'

const pricing: ModelPricing | undefined = getModelPricing('gpt-4o')
// { model: 'gpt-4o', provider: 'openai', input: 2.50, output: 10.00 }
```
