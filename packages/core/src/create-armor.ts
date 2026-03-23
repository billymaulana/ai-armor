import type { ArmorConfig, ArmorContext, ArmorInstance, ArmorLog, ArmorRequest, FallbackResult, RateLimitResult, SafetyCheckResult } from './types'
import { createExactCache } from './cache/exact-cache'
import { createCostTracker } from './cost/tracker'
import { createFallbackChain } from './fallback/chain'
import { createLogger } from './logging/logger'
import { calculateCost } from './pricing/database'
import { createSlidingWindowLimiter } from './rate-limit/sliding-window'
import { createModelResolver } from './routing/resolver'
import { createSafetyGuard } from './safety/guard'

const BUDGET_WARN_DEBOUNCE_MS = 5 * 60 * 1000 // 5 minutes

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

  const safetyGuard = config.safety
    ? createSafetyGuard(config.safety)
    : undefined

  const fallbackChain = config.fallback
    ? createFallbackChain(config.fallback)
    : undefined

  let lastBudgetWarnedAt = 0

  return {
    config,

    async checkRateLimit(ctx: ArmorContext): Promise<RateLimitResult> {
      if (!rateLimiter) {
        return { allowed: true, remaining: Number.POSITIVE_INFINITY, resetAt: 0 }
      }
      return rateLimiter.check(ctx)
    },

    async peekRateLimit(ctx: ArmorContext): Promise<{ remaining: number, resetAt: number }> {
      if (!rateLimiter) {
        return { remaining: Number.POSITIVE_INFINITY, resetAt: 0 }
      }
      return rateLimiter.peek(ctx)
    },

    async trackCost(model: string, inputTokens: number, outputTokens: number, userId?: string): Promise<void> {
      if (costTracker) {
        await costTracker.trackUsage(model, inputTokens, outputTokens, userId)
      }
    },

    async getDailyCost(userId?: string): Promise<number> {
      if (!costTracker) {
        return 0
      }
      return costTracker.getDailyCost(userId)
    },

    async getMonthlyCost(userId?: string): Promise<number> {
      if (!costTracker) {
        return 0
      }
      return costTracker.getMonthlyCost(userId)
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
      // Fire onWarned callback when budget is exceeded with 'warn' action.
      // Debounce: fire at most once per 5 minutes to avoid flooding alert systems.
      if (result.action === 'warn' && config.budget?.onWarned) {
        const now = Date.now()
        if (now - lastBudgetWarnedAt > BUDGET_WARN_DEBOUNCE_MS) {
          lastBudgetWarnedAt = now
          const budgetInfo: { daily: number, monthly: number, perUserDaily?: number } = {
            daily: result.currentDaily,
            monthly: result.currentMonthly,
          }
          if (result.perUserDaily !== undefined) {
            budgetInfo.perUserDaily = result.perUserDaily
          }
          config.budget.onWarned(ctx, budgetInfo)
        }
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

    checkSafety(request: ArmorRequest, ctx: ArmorContext): SafetyCheckResult {
      if (!safetyGuard) {
        return { allowed: true, blocked: false, reason: null, details: [] }
      }
      return safetyGuard.check(request, ctx)
    },

    async executeFallback<T>(request: ArmorRequest, handler: (model: string) => Promise<T>): Promise<FallbackResult<T>> {
      if (!fallbackChain) {
        const result = await handler(request.model)
        return { result, model: request.model, attempts: 1, fallbackUsed: false }
      }
      return fallbackChain.execute(request, handler)
    },
  }
}
