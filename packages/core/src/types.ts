export interface RateLimitConfig {
  strategy: 'sliding-window'
  rules: RateLimitRule[]
  store?: 'memory' | 'redis' | StorageAdapter
  keyResolver?: (ctx: ArmorContext, ruleKey: string) => string
  onLimited?: (ctx: ArmorContext) => void
}

export interface RateLimitRule {
  key: 'user' | 'ip' | 'apiKey' | (string & {})
  limit: number
  window: string
}

export interface BudgetConfig {
  daily?: number
  monthly?: number
  perUser?: number
  perUserMonthly?: number
  onExceeded: 'block' | 'warn' | 'downgrade-model'
  downgradeMap?: Record<string, string>
  store?: 'memory' | 'redis' | StorageAdapter
  onWarned?: (ctx: ArmorContext, budget: { daily: number, monthly: number, perUserDaily?: number, perUserMonthly?: number }) => void
  onUnknownModel?: (model: string) => void
}

export interface FallbackConfig {
  chains: Record<string, string[]>
  timeout?: number
  retries?: number
  backoff?: 'exponential' | 'linear'
  healthCheck?: boolean
}

export interface ExactCacheConfig {
  enabled: boolean
  strategy: 'exact'
  ttl: number
  maxSize?: number
  keyFn?: (request: ArmorRequest) => string
}

export interface SemanticCacheConfig {
  enabled: boolean
  strategy: 'semantic'
  ttl: number
  maxSize?: number
  /** User-provided embedding function. Must return a number[] vector. */
  embeddingFn: (text: string) => Promise<number[]>
  /** Minimum cosine similarity to consider a cache hit (default: 0.92) */
  similarityThreshold?: number
  /** Custom text extractor from request (default: JSON.stringify messages) */
  keyFn?: (request: ArmorRequest) => string
}

export type CacheConfig = ExactCacheConfig | SemanticCacheConfig

export interface RoutingConfig {
  aliases: Record<string, string>
}

export interface SafetyConfig {
  promptInjection?: boolean
  piiDetection?: boolean
  maxTokensPerRequest?: number
  blockedPatterns?: RegExp[]
  onBlocked?: (ctx: ArmorContext, reason: string) => void
}

export interface LoggingConfig {
  enabled: boolean
  include: Array<'model' | 'tokens' | 'cost' | 'latency' | 'userId' | 'cached' | 'fallback'>
  onRequest?: (log: ArmorLog) => void | Promise<void>
  maxEntries?: number
}

export interface ArmorConfig {
  rateLimit?: RateLimitConfig
  budget?: BudgetConfig
  fallback?: FallbackConfig
  cache?: CacheConfig
  routing?: RoutingConfig
  safety?: SafetyConfig
  logging?: LoggingConfig
}

export interface ArmorContext {
  userId?: string
  ip?: string
  apiKey?: string
  headers?: Record<string, string>
  model?: string
  [key: string]: unknown
}

export interface ArmorRequest {
  model: string
  messages: unknown[]
  temperature?: number
  tools?: unknown[]
}

export interface ArmorLog {
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

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

export interface SafetyCheckResult {
  allowed: boolean
  blocked: boolean
  reason: string | null
  details: string[]
}

export interface FallbackResult<T = unknown> {
  result: T
  model: string
  attempts: number
  fallbackUsed: boolean
}

export interface ArmorInstance {
  config: ArmorConfig
  checkRateLimit: (ctx: ArmorContext) => Promise<RateLimitResult>
  peekRateLimit: (ctx: ArmorContext) => Promise<{ remaining: number, resetAt: number }>
  trackCost: (model: string, inputTokens: number, outputTokens: number, userId?: string) => Promise<void>
  checkBudget: (model: string, ctx: ArmorContext) => Promise<{ allowed: boolean, action: 'block' | 'warn' | 'downgrade-model' | 'pass', suggestedModel?: string | undefined }>
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

/**
 * External storage adapter for rate limiting and budget tracking.
 *
 * **Concurrency note:** The built-in in-memory store is safe under Node.js
 * single-threaded concurrency. For multi-instance deployments (e.g. multiple
 * server processes or serverless), provide a StorageAdapter backed by an
 * atomic store (e.g. Redis with Lua scripts) to prevent TOCTOU race conditions
 * in rate limiting and budget enforcement.
 */
export interface StorageAdapter {
  getItem: (key: string) => Promise<unknown>
  setItem: (key: string, value: unknown) => Promise<void>
  removeItem: (key: string) => Promise<void>
}
