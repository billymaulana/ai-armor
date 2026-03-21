// Main entry
export { createArmor } from './create-armor'

// Types
export type {
  ArmorConfig,
  ArmorContext,
  ArmorInstance,
  ArmorLog,
  ArmorRequest,
  BudgetConfig,
  CacheConfig,
  FallbackConfig,
  LoggingConfig,
  RateLimitConfig,
  RateLimitResult,
  RateLimitRule,
  RoutingConfig,
  SafetyConfig,
  StorageAdapter,
} from './types'

// Pricing utilities
export { calculateCost, getAllModels, getModelPricing, getProvider } from './pricing'
export type { ModelPricing } from './pricing'
