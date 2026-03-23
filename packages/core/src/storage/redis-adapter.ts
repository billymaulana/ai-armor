import type { StorageAdapter } from '../types'

/**
 * Redis-compatible client interface.
 * Works with ioredis, @upstash/redis, and any client that implements these methods.
 */
export interface RedisLike {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string, ...args: unknown[]) => Promise<unknown>
  del: (key: string | string[]) => Promise<unknown>
}

export interface RedisAdapterOptions {
  /** Key prefix for namespace isolation (default: 'ai-armor:') */
  prefix?: string
  /** TTL in seconds for auto-expiry. 0 = no expiry. (default: 0) */
  ttl?: number
}

/**
 * Creates a StorageAdapter backed by a Redis-compatible client.
 *
 * Usage:
 * ```ts
 * import Redis from 'ioredis'
 * import { createRedisAdapter } from 'ai-armor'
 *
 * const redis = new Redis()
 * const adapter = createRedisAdapter(redis, { prefix: 'myapp:', ttl: 86400 })
 *
 * const armor = createArmor({
 *   rateLimit: { ..., store: adapter },
 *   budget: { ..., store: adapter },
 * })
 * ```
 */
export function createRedisAdapter(client: RedisLike, options?: RedisAdapterOptions): StorageAdapter {
  const prefix = options?.prefix ?? 'ai-armor:'
  const ttl = options?.ttl ?? 0

  function prefixKey(key: string): string {
    return `${prefix}${key}`
  }

  return {
    async getItem(key: string): Promise<unknown> {
      const raw = await client.get(prefixKey(key))
      if (raw === null)
        return null
      try {
        return JSON.parse(raw)
      }
      catch {
        return raw
      }
    },

    async setItem(key: string, value: unknown): Promise<void> {
      const serialized = JSON.stringify(value)
      if (ttl > 0) {
        await client.set(prefixKey(key), serialized, 'EX', ttl)
      }
      else {
        await client.set(prefixKey(key), serialized)
      }
    },

    async removeItem(key: string): Promise<void> {
      await client.del(prefixKey(key))
    },
  }
}
