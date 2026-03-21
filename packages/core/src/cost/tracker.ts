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
  suggestedModel?: string
}

function getStartOfDay(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

function getStartOfMonth(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
}

export function createCostTracker(config: BudgetConfig) {
  const memoryStore: CostStore = { entries: [] }
  let externalStore: StorageAdapter | undefined

  if (config.store && typeof config.store === 'object') {
    externalStore = config.store
  }

  async function getEntries(): Promise<CostEntry[]> {
    if (externalStore) {
      const data = await externalStore.getItem('cost-entries')
      return (data as CostEntry[]) ?? []
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

  async function trackUsage(model: string, inputTokens: number, outputTokens: number, userId?: string): Promise<void> {
    const cost = calculateCost(model, inputTokens, outputTokens)
    const entries = await getEntries()

    entries.push({
      timestamp: Date.now(),
      model,
      cost,
      userId,
    })

    await setEntries(entries)
  }

  async function getDailyCost(userId?: string): Promise<number> {
    const dayStart = getStartOfDay()
    const entries = await getEntries()

    return entries
      .filter(e => e.timestamp >= dayStart && (!userId || e.userId === userId))
      .reduce((sum, e) => sum + e.cost, 0)
  }

  async function getMonthlyCost(userId?: string): Promise<number> {
    const monthStart = getStartOfMonth()
    const entries = await getEntries()

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
      return {
        allowed: config.onExceeded !== 'block',
        action: config.onExceeded,
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
      return {
        allowed: config.onExceeded !== 'block',
        action: config.onExceeded,
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
          suggestedModel: config.downgradeMap[model],
        }
      }
      return {
        allowed: config.onExceeded !== 'block',
        action: config.onExceeded,
        currentDaily: dailyCost,
        currentMonthly: monthlyCost,
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

  function reset(): void {
    memoryStore.entries = []
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
