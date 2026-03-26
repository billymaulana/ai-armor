import type { ArmorContext, BudgetConfig, StorageAdapter } from '../types'
import type { BudgetCheckResult, CostEntry, CostStore } from './budget-utils'
import { calculateCost, getModelPricing } from '../pricing/database'
import {
  checkBudgetAgainst,
  computeCosts,
  getStartOfDay,
  getStartOfMonth,
  pruneOldEntries,
} from './budget-utils'

export type { BudgetCheckResult }

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

  async function trackUsage(model: string, inputTokens: number, outputTokens: number, userId?: string): Promise<void> {
    const cost = calculateCost(model, inputTokens, outputTokens)
    if (cost === 0 && (inputTokens > 0 || outputTokens > 0) && config.onUnknownModel) {
      config.onUnknownModel(model)
    }
    let entries = await getEntries()

    // Prune entries older than 32 days to prevent unbounded memory growth
    entries = pruneOldEntries(entries)

    const entry: CostEntry = { timestamp: Date.now(), model, cost }
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
    const allEntries = pruneOldEntries(await getEntries())
    const totals = computeCosts(allEntries, ctx.userId)
    return checkBudgetAgainst(model, ctx.userId, totals, config)
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
