import type { RedisLike } from '../../../src/storage/redis-adapter'
import { vi } from 'vitest'

export interface MockRedis extends RedisLike {
  _store: Map<string, string>
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
  del: ReturnType<typeof vi.fn>
}

/**
 * Creates a mock Redis client backed by an in-memory Map.
 * All methods are vi.fn() spies so we can assert call args.
 */
export function createMockRedis(): MockRedis {
  const store = new Map<string, string>()

  return {
    _store: store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
      return 'OK'
    }),
    del: vi.fn(async (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key]
      let count = 0
      for (const k of keys) {
        if (store.delete(k))
          count++
      }
      return count
    }),
  }
}
