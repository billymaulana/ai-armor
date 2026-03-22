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

// --- Redis StorageAdapter implementation ---
function createRedisAdapter(redis: Redis): StorageAdapter {
  return {
    async getItem(key: string) {
      const data = await redis.get(`ai-armor:${key}`)
      if (!data)
        return null
      return JSON.parse(data)
    },
    async setItem(key: string, value: unknown) {
      await redis.set(`ai-armor:${key}`, JSON.stringify(value), 'EX', 86400) // 24h TTL
    },
    async removeItem(key: string) {
      await redis.del(`ai-armor:${key}`)
    },
  }
}

// --- Setup ---
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
const store = createRedisAdapter(redis)

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
  cache: { enabled: true, strategy: 'exact', ttl: 3600, driver: 'memory' },
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
