import type { ArmorRequest, CacheConfig } from '../types'

interface CacheEntry {
  key: string
  value: unknown
  expiresAt: number
  createdAt: number
}

export function createExactCache(config: CacheConfig) {
  const cache = new Map<string, CacheEntry>()
  const accessOrder: string[] = []

  function generateKey(request: ArmorRequest): string {
    if (config.keyFn) {
      return config.keyFn(request)
    }

    const keyData = {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      tools: request.tools,
    }

    return hashObject(keyData)
  }

  function hashObject(obj: unknown): string {
    const str = JSON.stringify(obj, Object.keys(obj as Record<string, unknown>).sort())
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash |= 0
    }
    return `cache:${hash.toString(36)}`
  }

  function evictExpired(): void {
    const now = Date.now()
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) {
        cache.delete(key)
        const idx = accessOrder.indexOf(key)
        if (idx !== -1)
          accessOrder.splice(idx, 1)
      }
    }
  }

  function evictLRU(): void {
    if (!config.maxSize || cache.size <= config.maxSize)
      return

    while (cache.size > config.maxSize && accessOrder.length > 0) {
      const oldest = accessOrder.shift()
      if (oldest)
        cache.delete(oldest)
    }
  }

  function get(request: ArmorRequest): unknown | undefined {
    if (!config.enabled)
      return undefined

    evictExpired()

    const key = generateKey(request)
    const entry = cache.get(key)

    if (!entry)
      return undefined

    if (entry.expiresAt <= Date.now()) {
      cache.delete(key)
      const idx = accessOrder.indexOf(key)
      if (idx !== -1)
        accessOrder.splice(idx, 1)
      return undefined
    }

    // Move to end (most recently used)
    const idx = accessOrder.indexOf(key)
    if (idx !== -1)
      accessOrder.splice(idx, 1)
    accessOrder.push(key)

    return entry.value
  }

  function set(request: ArmorRequest, value: unknown): void {
    if (!config.enabled)
      return

    const key = generateKey(request)
    const now = Date.now()

    cache.set(key, {
      key,
      value,
      expiresAt: now + (config.ttl * 1000),
      createdAt: now,
    })

    const idx = accessOrder.indexOf(key)
    if (idx !== -1)
      accessOrder.splice(idx, 1)
    accessOrder.push(key)

    evictLRU()
  }

  function has(request: ArmorRequest): boolean {
    return get(request) !== undefined
  }

  function size(): number {
    evictExpired()
    return cache.size
  }

  function clear(): void {
    cache.clear()
    accessOrder.length = 0
  }

  return {
    get,
    set,
    has,
    size,
    clear,
    generateKey,
  }
}
