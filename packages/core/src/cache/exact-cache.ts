import type { ArmorRequest, ExactCacheConfig } from '../types'

interface CacheEntry {
  value: unknown
  serializedKey: string
  expiresAt: number
}

/**
 * O(1) LRU exact-match cache using Map insertion-order trick.
 * Map preserves insertion order -- delete+reinsert moves to end.
 * First entry is always the LRU candidate.
 */
export function createExactCache(config: ExactCacheConfig) {
  const cache = new Map<string, CacheEntry>()

  function serializeRequest(request: ArmorRequest): string {
    return JSON.stringify({
      m: request.model,
      msg: request.messages,
      t: request.temperature,
      tools: request.tools,
    })
  }

  function generateKey(request: ArmorRequest): string {
    if (config.keyFn) {
      return config.keyFn(request)
    }
    // Use full serialized string as key to avoid hash collisions
    return serializeRequest(request)
  }

  function evictExpired(): void {
    const now = Date.now()
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) {
        cache.delete(key)
      }
    }
  }

  function evictLRU(): void {
    if (!config.maxSize || config.maxSize <= 0 || cache.size <= config.maxSize)
      return

    // Map iteration order = insertion order, first = oldest (LRU)
    // Safe: we only delete already-yielded keys, so the iterator never exhausts early
    const iterator = cache.keys()
    while (cache.size > config.maxSize) {
      cache.delete(iterator.next().value as string)
    }
  }

  function get(request: ArmorRequest): unknown | undefined {
    if (!config.enabled)
      return undefined

    const key = generateKey(request)
    const entry = cache.get(key)

    if (!entry)
      return undefined

    if (entry.expiresAt <= Date.now()) {
      cache.delete(key)
      return undefined
    }

    // O(1) move-to-end: delete and re-insert preserves Map order
    cache.delete(key)
    cache.set(key, entry)

    return entry.value
  }

  function set(request: ArmorRequest, value: unknown): void {
    if (!config.enabled)
      return

    const key = generateKey(request)

    // Delete first to ensure re-insert moves to end
    cache.delete(key)

    cache.set(key, {
      value,
      serializedKey: key,
      expiresAt: Date.now() + (config.ttl * 1000),
    })

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
