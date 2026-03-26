/**
 * Example: ai-armor with custom StorageAdapter (Redis)
 *
 * By default ai-armor uses in-memory storage (per-process).
 * For multi-instance deployments, pass a StorageAdapter to share
 * rate limit counters and cost data across processes.
 *
 * npm install ai-armor ioredis
 */

import type { StorageAdapter } from 'ai-armor'
import process from 'node:process'
import { createArmor } from 'ai-armor'
import Redis from 'ioredis'

// --- Production Redis StorageAdapter ---
interface RedisAdapterOptions {
  prefix?: string // Key namespace (default: 'ai-armor')
  ttl?: number // Default TTL in seconds (default: 86400 = 24h)
}

function createRedisAdapter(redis: Redis, options?: RedisAdapterOptions): StorageAdapter {
  const prefix = options?.prefix ?? 'ai-armor'
  const defaultTTL = options?.ttl ?? 86400

  return {
    async getItem(key: string) {
      const data = await redis.get(`${prefix}:${key}`)
      if (!data)
        return null
      try {
        return JSON.parse(data)
      }
      catch {
        return null
      }
    },
    async setItem(key: string, value: unknown) {
      // Rate limit entries expire faster than cost entries
      const ttl = key.startsWith('rate-limit:') ? 3600 : defaultTTL
      await redis.set(`${prefix}:${key}`, JSON.stringify(value), 'EX', ttl)
    },
    async removeItem(key: string) {
      await redis.del(`${prefix}:${key}`)
    },
  }
}

// --- Setup ---
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
const store = createRedisAdapter(redis, { prefix: 'myapp:armor' })

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [
      { key: 'user', limit: 60, window: '1m' },
      { key: 'ip', limit: 200, window: '1m' },
    ],
    store, // Shared across all server instances
  },
  budget: {
    daily: 500.0,
    monthly: 5000.0,
    perUser: 50.0,
    onExceeded: 'block',
    store, // Cost data shared across instances
  },
  cache: { enabled: true, strategy: 'exact', ttl: 3600 },
  logging: { enabled: true, include: ['model', 'tokens', 'cost', 'latency', 'userId'] },
})

async function main() {
  const ctx = { userId: 'user-from-server-2', ip: '10.0.0.5' }

  // Rate limit check hits Redis (shared state)
  const rateLimit = await armor.checkRateLimit(ctx)
  // eslint-disable-next-line no-console
  console.log('Rate limit:', rateLimit)

  // Cost tracking persists to Redis
  await armor.trackCost('gpt-4o', 500, 200, ctx.userId)

  // Budget check reads from Redis
  const budget = await armor.checkBudget('gpt-4o', ctx)
  // eslint-disable-next-line no-console
  console.log('Budget:', budget)

  await redis.quit()
}

main()
