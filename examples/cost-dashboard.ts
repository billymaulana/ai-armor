/**
 * Example: Standalone cost analytics dashboard
 *
 * Reads ai-armor logs and produces a comprehensive summary including
 * cost by provider, cost by user, cache hit rate, average latency,
 * and top expensive models. Useful for daily/weekly cost reporting.
 *
 * npm install ai-armor
 */

import type { ArmorLog } from 'ai-armor'
import { createArmor } from 'ai-armor'

// --- Armor instance (in production, this would be your shared singleton) ---
const armor = createArmor({
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency', 'cached', 'userId'],
    maxEntries: 50000,
  },
})

// --- Analytics interfaces ---
interface ProviderStats {
  requests: number
  totalCost: number
  avgLatency: number
  totalInputTokens: number
  totalOutputTokens: number
}

interface UserStats {
  requests: number
  totalCost: number
  models: Set<string>
}

interface ModelStats {
  requests: number
  totalCost: number
  avgCostPerRequest: number
  avgInputTokens: number
  avgOutputTokens: number
}

interface DashboardReport {
  period: { from: number, to: number }
  overview: {
    totalRequests: number
    totalCost: number
    avgCostPerRequest: number
    avgLatency: number
    cacheHitRate: number
    cacheHitCount: number
    rateLimitedCount: number
    fallbackCount: number
  }
  byProvider: Record<string, ProviderStats>
  byUser: Array<{ userId: string, requests: number, totalCost: number, models: string[] }>
  topExpensiveModels: Array<{ model: string } & ModelStats>
  costTimeline: Array<{ hour: string, cost: number, requests: number }>
}

// --- Build the dashboard report ---
function buildDashboard(logs: ArmorLog[]): DashboardReport {
  if (logs.length === 0) {
    return {
      period: { from: 0, to: 0 },
      overview: {
        totalRequests: 0,
        totalCost: 0,
        avgCostPerRequest: 0,
        avgLatency: 0,
        cacheHitRate: 0,
        cacheHitCount: 0,
        rateLimitedCount: 0,
        fallbackCount: 0,
      },
      byProvider: {},
      byUser: [],
      topExpensiveModels: [],
      costTimeline: [],
    }
  }

  // --- Overview ---
  const totalCost = logs.reduce((s, l) => s + l.cost, 0)
  const totalLatency = logs.reduce((s, l) => s + l.latency, 0)
  const cacheHits = logs.filter(l => l.cached).length
  const rateLimited = logs.filter(l => l.rateLimited).length
  const fallbacks = logs.filter(l => l.fallback).length
  const timestamps = logs.map(l => l.timestamp)

  // --- Cost by provider ---
  const providerMap = new Map<string, { cost: number, latency: number, count: number, input: number, output: number }>()
  for (const log of logs) {
    const entry = providerMap.get(log.provider) ?? { cost: 0, latency: 0, count: 0, input: 0, output: 0 }
    entry.cost += log.cost
    entry.latency += log.latency
    entry.count++
    entry.input += log.inputTokens
    entry.output += log.outputTokens
    providerMap.set(log.provider, entry)
  }

  const byProvider: Record<string, ProviderStats> = {}
  for (const [provider, data] of providerMap) {
    byProvider[provider] = {
      requests: data.count,
      totalCost: data.cost,
      avgLatency: Math.round(data.latency / data.count),
      totalInputTokens: data.input,
      totalOutputTokens: data.output,
    }
  }

  // --- Cost by user ---
  const userMap = new Map<string, UserStats>()
  for (const log of logs) {
    const uid = log.userId ?? 'anonymous'
    const entry = userMap.get(uid) ?? { requests: 0, totalCost: 0, models: new Set<string>() }
    entry.requests++
    entry.totalCost += log.cost
    entry.models.add(log.model)
    userMap.set(uid, entry)
  }

  const byUser = Array.from(userMap.entries())
    .map(([userId, stats]) => ({
      userId,
      requests: stats.requests,
      totalCost: stats.totalCost,
      models: Array.from(stats.models),
    }))
    .sort((a, b) => b.totalCost - a.totalCost)

  // --- Top expensive models ---
  const modelMap = new Map<string, { cost: number, count: number, input: number, output: number }>()
  for (const log of logs) {
    const entry = modelMap.get(log.model) ?? { cost: 0, count: 0, input: 0, output: 0 }
    entry.cost += log.cost
    entry.count++
    entry.input += log.inputTokens
    entry.output += log.outputTokens
    modelMap.set(log.model, entry)
  }

  const topExpensiveModels = Array.from(modelMap.entries())
    .map(([model, data]) => ({
      model,
      requests: data.count,
      totalCost: data.cost,
      avgCostPerRequest: data.cost / data.count,
      avgInputTokens: Math.round(data.input / data.count),
      avgOutputTokens: Math.round(data.output / data.count),
    }))
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 10)

  // --- Hourly cost timeline ---
  const hourlyMap = new Map<string, { cost: number, count: number }>()
  for (const log of logs) {
    const hourKey = new Date(log.timestamp).toISOString().slice(0, 13) // YYYY-MM-DDTHH
    const entry = hourlyMap.get(hourKey) ?? { cost: 0, count: 0 }
    entry.cost += log.cost
    entry.count++
    hourlyMap.set(hourKey, entry)
  }

  const costTimeline = Array.from(hourlyMap.entries())
    .map(([hour, data]) => ({ hour, cost: data.cost, requests: data.count }))
    .sort((a, b) => a.hour.localeCompare(b.hour))

  return {
    period: { from: Math.min(...timestamps), to: Math.max(...timestamps) },
    overview: {
      totalRequests: logs.length,
      totalCost,
      avgCostPerRequest: totalCost / logs.length,
      avgLatency: Math.round(totalLatency / logs.length),
      cacheHitRate: cacheHits / logs.length,
      cacheHitCount: cacheHits,
      rateLimitedCount: rateLimited,
      fallbackCount: fallbacks,
    },
    byProvider,
    byUser,
    topExpensiveModels,
    costTimeline,
  }
}

// --- Pretty print ---
function formatReport(report: DashboardReport): string {
  const lines: string[] = []
  const { overview } = report

  lines.push('=== AI Cost Dashboard ===')
  lines.push(`Period: ${new Date(report.period.from).toISOString()} - ${new Date(report.period.to).toISOString()}`)
  lines.push('')
  lines.push(`Total Requests:    ${overview.totalRequests}`)
  lines.push(`Total Cost:        $${overview.totalCost.toFixed(4)}`)
  lines.push(`Avg Cost/Request:  $${overview.avgCostPerRequest.toFixed(6)}`)
  lines.push(`Avg Latency:       ${overview.avgLatency}ms`)
  lines.push(`Cache Hit Rate:    ${(overview.cacheHitRate * 100).toFixed(1)}% (${overview.cacheHitCount} hits)`)
  lines.push(`Rate Limited:      ${overview.rateLimitedCount}`)
  lines.push(`Fallbacks:         ${overview.fallbackCount}`)

  lines.push('')
  lines.push('--- Cost by Provider ---')
  for (const [provider, stats] of Object.entries(report.byProvider)) {
    lines.push(`  ${provider}: $${stats.totalCost.toFixed(4)} (${stats.requests} reqs, avg ${stats.avgLatency}ms)`)
  }

  lines.push('')
  lines.push('--- Top Users by Cost ---')
  for (const user of report.byUser.slice(0, 5)) {
    lines.push(`  ${user.userId}: $${user.totalCost.toFixed(4)} (${user.requests} reqs)`)
  }

  lines.push('')
  lines.push('--- Top Expensive Models ---')
  for (const model of report.topExpensiveModels.slice(0, 5)) {
    lines.push(`  ${model.model}: $${model.totalCost.toFixed(4)} total, $${model.avgCostPerRequest.toFixed(6)}/req`)
  }

  return lines.join('\n')
}

// --- Usage: seed some sample logs and generate report ---
async function main() {
  const sampleLogs: ArmorLog[] = [
    { id: '1', timestamp: Date.now() - 3600000, model: 'gpt-4o', provider: 'openai', inputTokens: 500, outputTokens: 200, cost: 0.0085, latency: 1200, cached: false, fallback: false, rateLimited: false, userId: 'user-a' },
    { id: '2', timestamp: Date.now() - 3500000, model: 'gpt-4o-mini', provider: 'openai', inputTokens: 300, outputTokens: 150, cost: 0.0001, latency: 400, cached: false, fallback: false, rateLimited: false, userId: 'user-b' },
    { id: '3', timestamp: Date.now() - 3400000, model: 'claude-sonnet-4-20250514', provider: 'anthropic', inputTokens: 800, outputTokens: 400, cost: 0.012, latency: 2100, cached: false, fallback: false, rateLimited: false, userId: 'user-a' },
    { id: '4', timestamp: Date.now() - 3300000, model: 'gpt-4o', provider: 'openai', inputTokens: 500, outputTokens: 200, cost: 0.0085, latency: 0, cached: true, fallback: false, rateLimited: false, userId: 'user-c' },
    { id: '5', timestamp: Date.now() - 3200000, model: 'gemini-2.5-flash', provider: 'google', inputTokens: 600, outputTokens: 300, cost: 0.0004, latency: 800, cached: false, fallback: false, rateLimited: false, userId: 'user-a' },
    { id: '6', timestamp: Date.now() - 2000000, model: 'deepseek-chat', provider: 'deepseek', inputTokens: 400, outputTokens: 250, cost: 0.0002, latency: 600, cached: false, fallback: false, rateLimited: false, userId: 'user-b' },
    { id: '7', timestamp: Date.now() - 1800000, model: 'grok-2', provider: 'xai', inputTokens: 700, outputTokens: 350, cost: 0.007, latency: 1500, cached: false, fallback: true, rateLimited: false, userId: 'user-c' },
    { id: '8', timestamp: Date.now() - 1000000, model: 'o1', provider: 'openai', inputTokens: 1000, outputTokens: 2000, cost: 0.09, latency: 8000, cached: false, fallback: false, rateLimited: false, userId: 'user-a' },
  ]

  // Inject sample logs
  for (const log of sampleLogs) {
    await armor.log(log)
  }

  // Generate and print report
  const logs = armor.getLogs()
  const report = buildDashboard(logs)
  // eslint-disable-next-line no-console
  console.log(formatReport(report))
}

main()
