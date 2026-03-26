import type { BudgetConfig } from '../types'

export interface CostEntry {
  timestamp: number
  model: string
  cost: number
  userId?: string | undefined
}

export interface CostStore {
  entries: CostEntry[]
}

export interface BudgetCheckResult {
  allowed: boolean
  action: 'block' | 'warn' | 'downgrade-model' | 'pass'
  currentDaily: number
  currentMonthly: number
  perUserDaily?: number
  perUserMonthly?: number
  suggestedModel?: string
}

export function getStartOfDay(): number {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
}

export function getStartOfMonth(): number {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
}

export function pruneOldEntries(entries: CostEntry[]): CostEntry[] {
  // Keep entries from the last 32 days (covers monthly window + 1 day buffer)
  const cutoff = Date.now() - (32 * 24 * 60 * 60 * 1000)
  return entries.filter(e => e.timestamp > cutoff)
}

export function computeCosts(entries: CostEntry[], userId?: string) {
  const dayStart = getStartOfDay()
  const monthStart = getStartOfMonth()
  let dailyCost = 0
  let monthlyCost = 0
  let userDailyCost = 0
  let userMonthlyCost = 0

  for (const e of entries) {
    if (e.timestamp >= monthStart) {
      monthlyCost += e.cost
      if (userId && e.userId === userId) {
        userMonthlyCost += e.cost
      }
    }
    if (e.timestamp >= dayStart) {
      dailyCost += e.cost
      if (userId && e.userId === userId) {
        userDailyCost += e.cost
      }
    }
  }

  return { dailyCost, monthlyCost, userDailyCost, userMonthlyCost }
}

interface ExceededBase {
  dailyCost: number
  monthlyCost: number
  model: string
  config: BudgetConfig
}

function buildExceededResult(
  base: ExceededBase,
  extra?: { perUserDaily?: number, perUserMonthly?: number },
): BudgetCheckResult {
  const { dailyCost, monthlyCost, model, config } = base
  if (config.onExceeded === 'downgrade-model' && config.downgradeMap?.[model]) {
    return {
      allowed: true,
      action: 'downgrade-model',
      currentDaily: dailyCost,
      currentMonthly: monthlyCost,
      ...extra,
      suggestedModel: config.downgradeMap[model],
    }
  }
  const effectiveAction = config.onExceeded === 'downgrade-model' ? 'block' : config.onExceeded
  return {
    allowed: effectiveAction === 'warn',
    action: effectiveAction,
    currentDaily: dailyCost,
    currentMonthly: monthlyCost,
    ...extra,
  }
}

export interface CostTotals {
  dailyCost: number
  monthlyCost: number
  userDailyCost: number
  userMonthlyCost: number
}

export function checkBudgetAgainst(
  model: string,
  userId: string | undefined,
  totals: CostTotals,
  config: BudgetConfig,
): BudgetCheckResult {
  const { dailyCost, monthlyCost, userDailyCost, userMonthlyCost } = totals
  const base = { dailyCost, monthlyCost, model, config }

  if (config.monthly && monthlyCost >= config.monthly)
    // downgrade-model without mapping falls back to block (safe default)
    return buildExceededResult(base)

  if (config.daily && dailyCost >= config.daily)
    return buildExceededResult(base)

  if (config.perUser && userId && userDailyCost >= config.perUser)
    return buildExceededResult(base, { perUserDaily: userDailyCost })

  if (config.perUserMonthly && userId && userMonthlyCost >= config.perUserMonthly)
    return buildExceededResult(base, { perUserMonthly: userMonthlyCost })

  return { allowed: true, action: 'pass', currentDaily: dailyCost, currentMonthly: monthlyCost }
}
