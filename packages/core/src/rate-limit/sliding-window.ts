import type { RateLimitConfig, ArmorContext, StorageAdapter } from '../types'

interface WindowEntry {
  timestamp: number
}

interface RateLimitStore {
  entries: Map<string, WindowEntry[]>
}

function parseWindow(window: string): number {
  const match = window.match(/^(\d+)(s|m|h|d)$/)
  if (!match) {
    throw new Error(`Invalid window format: "${window}". Use format like "1m", "1h", "1d"`)
  }

  const value = Number.parseInt(match[1]!, 10)
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
    return config.keyResolver(ctx)
  }

  switch (ruleKey) {
    case 'user':
      return ctx.userId ?? 'anonymous'
    case 'ip':
      return ctx.ip ?? 'unknown'
    case 'apiKey':
      return ctx.apiKey ?? 'unknown'
    default:
      return (ctx[ruleKey] as string) ?? 'unknown'
  }
}

export function createSlidingWindowLimiter(config: RateLimitConfig) {
  const store: RateLimitStore = { entries: new Map() }
  let externalStore: StorageAdapter | undefined

  if (config.store && typeof config.store === 'object') {
    externalStore = config.store
  }

  function getStoreKey(ruleKey: string, resolvedKey: string): string {
    return `rate-limit:${ruleKey}:${resolvedKey}`
  }

  async function getEntries(key: string): Promise<WindowEntry[]> {
    if (externalStore) {
      const data = await externalStore.getItem(key)
      return (data as WindowEntry[]) ?? []
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

    for (const rule of config.rules) {
      const resolvedKey = resolveKey(config, ctx, rule.key)
      const storeKey = getStoreKey(rule.key, resolvedKey)
      const windowMs = parseWindow(rule.window)
      const windowStart = now - windowMs

      let entries = await getEntries(storeKey)

      // Remove expired entries (outside the window)
      entries = entries.filter(e => e.timestamp > windowStart)

      if (entries.length >= rule.limit) {
        // Rate limited
        const oldestInWindow = entries[0]!.timestamp
        const resetAt = oldestInWindow + windowMs

        if (config.onLimited) {
          config.onLimited(ctx)
        }

        await setEntries(storeKey, entries)

        return {
          allowed: false,
          remaining: 0,
          resetAt,
        }
      }

      // Add new entry
      entries.push({ timestamp: now })
      await setEntries(storeKey, entries)
    }

    // Calculate remaining from the most restrictive rule
    let minRemaining = Number.POSITIVE_INFINITY
    let earliestReset = 0

    for (const rule of config.rules) {
      const resolvedKey = resolveKey(config, ctx, rule.key)
      const storeKey = getStoreKey(rule.key, resolvedKey)
      const windowMs = parseWindow(rule.window)
      const entries = await getEntries(storeKey)
      const remaining = rule.limit - entries.length

      if (remaining < minRemaining) {
        minRemaining = remaining
        earliestReset = now + windowMs
      }
    }

    return {
      allowed: true,
      remaining: minRemaining === Number.POSITIVE_INFINITY ? 0 : minRemaining,
      resetAt: earliestReset,
    }
  }

  function reset(): void {
    store.entries.clear()
  }

  return {
    check,
    reset,
  }
}

export { parseWindow }
