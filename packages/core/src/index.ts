// Main entry
export { createArmor } from './create-armor'

// Pricing utilities
export { addModel, calculateCost, getAllModels, getModelPricing, getProvider, registerModels, removeModel, resetPricing, updateModel } from './pricing'

export type { ModelPricing } from './pricing'
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
  FallbackResult,
  LoggingConfig,
  RateLimitConfig,
  RateLimitResult,
  RateLimitRule,
  RoutingConfig,
  SafetyCheckResult,
  SafetyConfig,
  StorageAdapter,
} from './types'
