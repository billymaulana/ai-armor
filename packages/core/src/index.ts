export { cosineSimilarity } from './cache/cosine-similarity'

// Cache utilities
export { createSemanticCache } from './cache/semantic-cache'
// Main entry
export { createArmor } from './create-armor'

// Pricing utilities
export { addModel, calculateCost, createPricingRegistry, getAllModels, getModelPricing, getProvider, registerModels, removeModel, resetPricing, updateModel } from './pricing'
export type { ModelPricing, PricingRegistry } from './pricing'

// Storage adapters
export { createRedisAdapter } from './storage/redis-adapter'

export type { RedisAdapterOptions, RedisLike } from './storage/redis-adapter'
// Types
export type {
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
} from './types'
