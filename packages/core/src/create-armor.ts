import type { ArmorConfig, ArmorContext, ArmorInstance, ArmorLog, ArmorRequest, RateLimitResult } from './types'
import { createExactCache } from './cache/exact-cache'
import { createCostTracker } from './cost/tracker'
import { createLogger } from './logging/logger'
import { calculateCost } from './pricing/database'
import { createSlidingWindowLimiter } from './rate-limit/sliding-window'
import { createModelResolver } from './routing/resolver'

export function createArmor(config: ArmorConfig): ArmorInstance {
  // Initialize modules based on config
  const rateLimiter = config.rateLimit
    ? createSlidingWindowLimiter(config.rateLimit)
    : undefined

  const costTracker = config.budget
    ? createCostTracker(config.budget)
    : undefined

  const modelResolver = config.routing
    ? createModelResolver(config.routing)
    : undefined

  const cache = config.cache
    ? createExactCache(config.cache)
    : undefined

  const logger = config.logging
    ? createLogger(config.logging)
    : undefined

  return {
    config,

    async checkRateLimit(ctx: ArmorContext): Promise<RateLimitResult> {
      if (!rateLimiter) {
        return { allowed: true, remaining: Number.POSITIVE_INFINITY, resetAt: 0 }
      }
      return rateLimiter.check(ctx)
    },

    async trackCost(model: string, inputTokens: number, outputTokens: number, userId?: string): Promise<void> {
      if (costTracker) {
        await costTracker.trackUsage(model, inputTokens, outputTokens, userId)
      }
    },

    async checkBudget(model: string, ctx: ArmorContext) {
      if (!costTracker) {
        return { allowed: true as const, action: 'pass' as const }
      }
      const result = await costTracker.checkBudget(model, ctx)
      const out: { allowed: boolean, action: string, suggestedModel?: string | undefined } = {
        allowed: result.allowed,
        action: result.action,
      }
      if (result.suggestedModel !== undefined) {
        out.suggestedModel = result.suggestedModel
      }
      return out
    },

    resolveModel(model: string): string {
      if (modelResolver) {
        return modelResolver.resolve(model)
      }
      return model
    },

    getCachedResponse(request: ArmorRequest): unknown | undefined {
      if (!cache)
        return undefined
      return cache.get(request)
    },

    setCachedResponse(request: ArmorRequest, response: unknown): void {
      if (cache) {
        cache.set(request, response)
      }
    },

    async log(entry: ArmorLog): Promise<void> {
      if (logger) {
        await logger.log(entry)
      }
    },

    getLogs(): ArmorLog[] {
      if (logger) {
        return logger.getLogs()
      }
      return []
    },

    estimateCost(model: string, inputTokens: number, outputTokens: number): number {
      return calculateCost(model, inputTokens, outputTokens)
    },
  }
}
