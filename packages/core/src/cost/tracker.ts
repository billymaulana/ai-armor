import type { ArmorContext, BudgetConfig, StorageAdapter } from '../types'
import { calculateCost, getModelPricing } from '../pricing/database'

interface CostEntry {
  timestamp: number
  model: string
  cost: number
  userId?: string | undefined
}

interface CostStore {
  entries: CostEntry[]
}

export interface BudgetCheckResult {
  allowed: boolean
  action: 'block' | 'warn' | 'downgrade-model' | 'pass'
  currentDaily: number
  currentMonthly: number
  perUserDaily?: number
  suggestedModel?: string
}

function getStartOfDay(): number {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
}

function getStartOfMonth(): number {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
}

export function createCostTracker(config: BudgetConfig) {
  const memoryStore: CostStore = { entries: [] }
  let externalStore: StorageAdapter | undefined

  if (config.store === 'redis') {
    throw new Error('[ai-armor] store: "redis" requires passing a StorageAdapter instance. See docs for setup.')
  }
  if (config.store && typeof config.store === 'object') {
    externalStore = config.store
  }

  async function getEntries(): Promise<CostEntry[]> {
    if (externalStore) {
      const data = await externalStore.getItem('cost-entries')
      if (!Array.isArray(data))
        return []
      return data as CostEntry[]
    }
    return memoryStore.entries
  }

  async function setEntries(entries: CostEntry[]): Promise<void> {
    if (externalStore) {
      await externalStore.setItem('cost-entries', entries)
      return
    }
    memoryStore.entries = entries
  }

  function pruneOldEntries(entries: CostEntry[]): CostEntry[] {
    // Keep entries from the last 32 days (covers monthly window + 1 day buffer)
    const cutoff = Date.now() - (32 * 24 * 60 * 60 * 1000)
    return entries.filter(e => e.timestamp > cutoff)
  }

  async function trackUsage(model: string, inputTokens: number, outputTokens: number, userId?: string): Promise<void> {
    const cost = calculateCost(model, inputTokens, outputTokens)
    if (cost === 0 && (inputTokens > 0 || outputTokens > 0) && config.onUnknownModel) {
      config.onUnknownModel(model)
    }
    let entries = await getEntries()

    // Prune entries older than 32 days to prevent unbounded memory growth
    entries = pruneOldEntries(entries)

    const entry: CostEntry = {
      timestamp: Date.now(),
      model,
      cost,
    }
    if (userId !== undefined) {
      entry.userId = userId
    }

    entries.push(entry)

    await setEntries(entries)
  }

  async function getDailyCost(userId?: string): Promise<number> {
    const dayStart = getStartOfDay()
    const entries = pruneOldEntries(await getEntries())

    return entries
      .filter(e => e.timestamp >= dayStart && (!userId || e.userId === userId))
      .reduce((sum, e) => sum + e.cost, 0)
  }

  async function getMonthlyCost(userId?: string): Promise<number> {
    const monthStart = getStartOfMonth()
    const entries = pruneOldEntries(await getEntries())

    return entries
      .filter(e => e.timestamp >= monthStart && (!userId || e.userId === userId))
      .reduce((sum, e) => sum + e.cost, 0)
  }

  async function checkBudget(model: string, ctx: ArmorContext): Promise<BudgetCheckResult> {
    const dailyCost = await getDailyCost()
    const monthlyCost = await getMonthlyCost()
    const userDailyCost = ctx.userId ? await getDailyCost(ctx.userId) : 0

    // Check monthly limit
    if (config.monthly && monthlyCost >= config.monthly) {
      if (config.onExceeded === 'downgrade-model' && config.downgradeMap?.[model]) {
        return {
          allowed: true,
          action: 'downgrade-model',
          currentDaily: dailyCost,
          currentMonthly: monthlyCost,
          suggestedModel: config.downgradeMap[model],
        }
      }
      // downgrade-model without mapping falls back to block (safe default)
      const effectiveAction = config.onExceeded === 'downgrade-model' ? 'block' : config.onExceeded
      return {
        allowed: effectiveAction === 'warn',
        action: effectiveAction,
        currentDaily: dailyCost,
        currentMonthly: monthlyCost,
      }
    }

    // Check daily limit
    if (config.daily && dailyCost >= config.daily) {
      if (config.onExceeded === 'downgrade-model' && config.downgradeMap?.[model]) {
        return {
          allowed: true,
          action: 'downgrade-model',
          currentDaily: dailyCost,
          currentMonthly: monthlyCost,
          suggestedModel: config.downgradeMap[model],
        }
      }
      const effectiveAction = config.onExceeded === 'downgrade-model' ? 'block' : config.onExceeded
      return {
        allowed: effectiveAction === 'warn',
        action: effectiveAction,
        currentDaily: dailyCost,
        currentMonthly: monthlyCost,
      }
    }

    // Check per-user limit
    if (config.perUser && ctx.userId && userDailyCost >= config.perUser) {
      if (config.onExceeded === 'downgrade-model' && config.downgradeMap?.[model]) {
        return {
          allowed: true,
          action: 'downgrade-model',
          currentDaily: dailyCost,
          currentMonthly: monthlyCost,
          perUserDaily: userDailyCost,
          suggestedModel: config.downgradeMap[model],
        }
      }
      const effectiveAction = config.onExceeded === 'downgrade-model' ? 'block' : config.onExceeded
      return {
        allowed: effectiveAction === 'warn',
        action: effectiveAction,
        currentDaily: dailyCost,
        currentMonthly: monthlyCost,
        perUserDaily: userDailyCost,
      }
    }

    return {
      allowed: true,
      action: 'pass',
      currentDaily: dailyCost,
      currentMonthly: monthlyCost,
    }
  }

  function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    return calculateCost(model, inputTokens, outputTokens)
  }

  function hasModelPricing(model: string): boolean {
    return getModelPricing(model) !== undefined
  }

  async function reset(): Promise<void> {
    memoryStore.entries = []
    if (externalStore) {
      await externalStore.removeItem('cost-entries')
    }
  }

  return {
    trackUsage,
    getDailyCost,
    getMonthlyCost,
    checkBudget,
    estimateCost,
    hasModelPricing,
    reset,
  }
}
