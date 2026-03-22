import { useArmorInstance } from '../../utils/armor'

export default defineEventHandler(async (event) => {
  // If adminSecret is configured, require it via header
  const config = useRuntimeConfig()
  const expected = (config.aiArmor as Record<string, unknown>)?.adminSecret as string | undefined

  if (expected) {
    const provided = getRequestHeader(event, 'x-armor-admin-secret')
    if (provided !== expected) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }
  }

  const armor = useArmorInstance()
  const logs = armor.getLogs()

  let todayCost = 0
  let monthCost = 0
  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const startOfMonth = new Date()
  startOfMonth.setUTCDate(1)
  startOfMonth.setUTCHours(0, 0, 0, 0)

  const costHistory: Array<{ date: string, cost: number }> = []
  const dailyCosts = new Map<string, number>()

  for (const log of logs) {
    const logDate = new Date(log.timestamp)
    const dateKey = logDate.toISOString().slice(0, 10)
    dailyCosts.set(dateKey, (dailyCosts.get(dateKey) ?? 0) + log.cost)

    if (log.timestamp >= startOfDay.getTime()) {
      todayCost += log.cost
    }
    if (log.timestamp >= startOfMonth.getTime()) {
      monthCost += log.cost
    }
  }

  for (const [date, cost] of dailyCosts) {
    costHistory.push({ date, cost })
  }
  costHistory.sort((a, b) => a.date.localeCompare(b.date))

  const budget = {
    daily: (armor.config.budget as Record<string, unknown> | undefined)?.daily as number ?? 0,
    monthly: (armor.config.budget as Record<string, unknown> | undefined)?.monthly as number ?? 0,
  }

  return {
    todayCost,
    monthCost,
    budget,
    costHistory,
  }
})
