import { useRuntimeConfig } from '#imports'
import { createError, defineEventHandler, getRequestHeader } from 'h3'
import { useArmorInstance } from '../../utils/armor'

export default defineEventHandler(async (event) => {
  // If adminSecret is configured, require it via header
  const config = useRuntimeConfig(event)
  const expected = (config.aiArmor as Record<string, unknown>)?.adminSecret as string | undefined

  if (expected) {
    const provided = getRequestHeader(event, 'x-armor-admin-secret')
    if (provided !== expected) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden', statusText: 'Forbidden' })
    }
  }

  const armor = useArmorInstance()

  // Read cost data from CostTracker (source of truth), not log buffer.
  // CostTracker persists across external stores and survives log rotation.
  const todayCost = await armor.getDailyCost()
  const monthCost = await armor.getMonthlyCost()

  // Cost history is still derived from logs (best-effort, for dashboard charts)
  const logs = armor.getLogs()
  const costHistory: Array<{ date: string, cost: number }> = []
  const dailyCosts = new Map<string, number>()

  for (const log of logs) {
    const dateKey = new Date(log.timestamp).toISOString().slice(0, 10)
    dailyCosts.set(dateKey, (dailyCosts.get(dateKey) ?? 0) + log.cost)
  }

  for (const [date, cost] of dailyCosts) {
    costHistory.push({ date, cost })
  }
  costHistory.sort((a, b) => a.date.localeCompare(b.date))

  const budget = {
    daily: armor.config.budget?.daily ?? 0,
    monthly: armor.config.budget?.monthly ?? 0,
  }

  return {
    todayCost,
    monthCost,
    budget,
    costHistory,
  }
})
