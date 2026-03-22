import type { ArmorContext, RateLimitConfig, StorageAdapter } from '../types'

interface WindowEntry {
  timestamp: number
}

interface RateLimitStore {
  entries: Map<string, WindowEntry[]>
}

function parseWindow(window: string): number {
  const match = window.match(/^(\d+)([smhd])$/)
  if (!match) {
    throw new Error(`Invalid window format: "${window}". Use format like "1m", "1h", "1d"`)
  }

  const value = Number.parseInt(match[1]!, 10)
  if (value === 0) {
    throw new Error(`Invalid window format: "${window}". Window must be greater than 0`)
  }
  const unit = match[2]!

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  }

  return value * multipliers[unit]!
}

function resolveKey(config: RateLimitConfig, ctx: ArmorContext, ruleKey: string): string {
  if (config.keyResolver) {
    return config.keyResolver(ctx, ruleKey)
  }

  switch (ruleKey) {
    case 'user':
      return ctx.userId ?? 'anonymous'
    case 'ip':
      return ctx.ip ?? 'unknown'
    case 'apiKey':
      return ctx.apiKey ?? 'unknown'
    default:
      if (Object.prototype.hasOwnProperty.call(ctx, ruleKey)) {
        return (ctx[ruleKey] as string) ?? 'unknown'
      }
      return 'unknown'
  }
}

export function createSlidingWindowLimiter(config: RateLimitConfig) {
  // Validate all rules eagerly at construction time (fail-fast)
  for (const rule of config.rules) {
    parseWindow(rule.window)
  }

  const store: RateLimitStore = { entries: new Map() }
  let externalStore: StorageAdapter | undefined

  if (config.store === 'redis') {
    throw new Error('[ai-armor] store: "redis" requires passing a StorageAdapter instance. See docs for setup.')
  }
  if (config.store && typeof config.store === 'object') {
    externalStore = config.store
  }

  function getStoreKey(ruleKey: string, resolvedKey: string): string {
    return `rate-limit:${ruleKey}:${resolvedKey}`
  }

  async function getEntries(key: string): Promise<WindowEntry[]> {
    if (externalStore) {
      const data = await externalStore.getItem(key)
      if (!Array.isArray(data))
        return []
      return data as WindowEntry[]
    }
    return store.entries.get(key) ?? []
  }

  async function setEntries(key: string, entries: WindowEntry[]): Promise<void> {
    if (externalStore) {
      await externalStore.setItem(key, entries)
      return
    }
    store.entries.set(key, entries)
  }

  async function check(ctx: ArmorContext): Promise<{ allowed: boolean, remaining: number, resetAt: number }> {
    const now = Date.now()

    // Phase 1: Read-only check -- evaluate ALL rules before mutating any state
    // This prevents partial state mutation when an inner rule blocks
    const ruleSnapshots: Array<{
      storeKey: string
      entries: WindowEntry[]
      windowMs: number
      limit: number
    }> = []

    for (const rule of config.rules) {
      const resolvedKey = resolveKey(config, ctx, rule.key)
      const storeKey = getStoreKey(rule.key, resolvedKey)
      const windowMs = parseWindow(rule.window)
      const windowStart = now - windowMs

      let entries = await getEntries(storeKey)

      // Remove expired entries
      entries = entries.filter(e => e.timestamp > windowStart)

      // Check if this rule blocks
      if (entries.length >= rule.limit) {
        const oldestInWindow = entries[0]!.timestamp
        const resetAt = oldestInWindow + windowMs

        // Persist pruned entries BEFORE firing callback (so external stores are consistent)
        await setEntries(storeKey, entries)

        if (config.onLimited) {
          config.onLimited(ctx)
        }

        return {
          allowed: false,
          remaining: 0,
          resetAt,
        }
      }

      ruleSnapshots.push({ storeKey, entries, windowMs, limit: rule.limit })
    }

    // Phase 2: All rules passed -- atomically add entry to all rules
    for (const snapshot of ruleSnapshots) {
      snapshot.entries.push({ timestamp: now })
      await setEntries(snapshot.storeKey, snapshot.entries)
    }

    // Calculate remaining from the most restrictive rule
    let minRemaining = Number.POSITIVE_INFINITY
    let earliestReset = 0

    for (const snapshot of ruleSnapshots) {
      const remaining = snapshot.limit - snapshot.entries.length
      if (remaining < minRemaining) {
        minRemaining = remaining
        earliestReset = now + snapshot.windowMs
      }
    }

    return {
      allowed: true,
      remaining: minRemaining === Number.POSITIVE_INFINITY ? 0 : minRemaining,
      resetAt: earliestReset,
    }
  }

  async function reset(): Promise<void> {
    store.entries.clear()
    // Note: external store entries are not cleared here because StorageAdapter
    // has no scan/clear API for key prefixes. For full external store reset,
    // use the adapter's native clear mechanism.
  }

  return {
    check,
    reset,
  }
}

export { parseWindow }
