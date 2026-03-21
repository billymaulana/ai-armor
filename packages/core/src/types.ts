export interface RateLimitConfig {
  strategy: 'sliding-window' | 'fixed-window' | 'token-bucket'
  rules: RateLimitRule[]
  store?: 'memory' | 'redis' | StorageAdapter
  keyResolver?: (ctx: ArmorContext) => string
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
  onExceeded: 'block' | 'warn' | 'downgrade-model'
  downgradeMap?: Record<string, string>
  store?: 'memory' | 'redis' | StorageAdapter
}

export interface FallbackConfig {
  chains: Record<string, string[]>
  timeout?: number
  retries?: number
  backoff?: 'exponential' | 'linear'
  healthCheck?: boolean
}

export interface CacheConfig {
  enabled: boolean
  strategy: 'exact'
  ttl: number
  driver: string
  maxSize?: number
  keyFn?: (request: ArmorRequest) => string
}

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

export interface ArmorInstance {
  config: ArmorConfig
  checkRateLimit: (ctx: ArmorContext) => Promise<boolean>
  trackCost: (log: ArmorLog) => Promise<void>
  resolveModel: (model: string) => string
}

export interface StorageAdapter {
  getItem: (key: string) => Promise<unknown>
  setItem: (key: string, value: unknown) => Promise<void>
  removeItem: (key: string) => Promise<void>
}
