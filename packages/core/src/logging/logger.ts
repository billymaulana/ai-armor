import type { ArmorLog, LoggingConfig } from '../types'

export function createLogger(config: LoggingConfig) {
  const logs: ArmorLog[] = []

  function filterLog(log: ArmorLog): Partial<ArmorLog> {
    if (!config.include || config.include.length === 0) {
      return log
    }

    const filtered: Partial<ArmorLog> = {
      id: log.id,
      timestamp: log.timestamp,
    }

    for (const field of config.include) {
      switch (field) {
        case 'model':
          filtered.model = log.model
          filtered.provider = log.provider
          break
        case 'tokens':
          filtered.inputTokens = log.inputTokens
          filtered.outputTokens = log.outputTokens
          break
        case 'cost':
          filtered.cost = log.cost
          break
        case 'latency':
          filtered.latency = log.latency
          break
        case 'userId':
          filtered.userId = log.userId
          break
        case 'cached':
          filtered.cached = log.cached
          break
        case 'fallback':
          filtered.fallback = log.fallback
          break
      }
    }

    return filtered
  }

  async function log(entry: ArmorLog): Promise<void> {
    if (!config.enabled) return

    logs.push(entry)

    if (config.onRequest) {
      await config.onRequest(entry)
    }
  }

  function getLogs(): ArmorLog[] {
    return [...logs]
  }

  function getFilteredLogs(): Partial<ArmorLog>[] {
    return logs.map(filterLog)
  }

  function clear(): void {
    logs.length = 0
  }

  return {
    log,
    getLogs,
    getFilteredLogs,
    clear,
  }
}
