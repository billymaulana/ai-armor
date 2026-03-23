import { describe, expect, it } from 'vitest'
import { createRedisAdapter } from '../../../src/storage/redis-adapter'
import { createMockRedis } from './mock-redis'

describe('createRedisAdapter serialization', () => {
  it('should serialize and deserialize arrays correctly', async () => {
    const redis = createMockRedis()
    const adapter = createRedisAdapter(redis)

    const timestamps = [1000, 2000, 3000]
    await adapter.setItem('timestamps', timestamps)

    const result = await adapter.getItem('timestamps')
    expect(result).toEqual(timestamps)
  })

  it('should serialize and deserialize numbers correctly', async () => {
    const redis = createMockRedis()
    const adapter = createRedisAdapter(redis)

    await adapter.setItem('cost', 42.5)
    const result = await adapter.getItem('cost')
    expect(result).toBe(42.5)
  })

  it('should serialize and deserialize boolean values correctly', async () => {
    const redis = createMockRedis()
    const adapter = createRedisAdapter(redis)

    await adapter.setItem('flag', true)
    const result = await adapter.getItem('flag')
    expect(result).toBe(true)
  })

  it('should handle null value serialization', async () => {
    const redis = createMockRedis()
    const adapter = createRedisAdapter(redis)

    await adapter.setItem('nullable', null)
    const result = await adapter.getItem('nullable')
    expect(result).toBeNull()
  })
})

describe('createRedisAdapter as StorageAdapter (integration)', () => {
  it('should work with rate limiter timestamp pattern', async () => {
    const redis = createMockRedis()
    const adapter = createRedisAdapter(redis, { prefix: 'rl:' })

    // Simulate what the rate limiter does: store timestamp arrays
    const key = 'user:user-1:requests'
    const now = Date.now()
    const timestamps = [now - 5000, now - 3000, now - 1000]

    await adapter.setItem(key, timestamps)

    const stored = await adapter.getItem(key) as number[]
    expect(stored).toEqual(timestamps)
    expect(stored).toHaveLength(3)

    // Simulate adding a new timestamp
    stored.push(now)
    await adapter.setItem(key, stored)

    const updated = await adapter.getItem(key) as number[]
    expect(updated).toHaveLength(4)
    expect(updated[3]).toBe(now)

    // Verify the underlying Redis calls used the correct prefix
    expect(redis.get).toHaveBeenCalledWith(`rl:${key}`)
    expect(redis.set).toHaveBeenCalledWith(`rl:${key}`, expect.any(String))

    // Cleanup
    await adapter.removeItem(key)
    const afterRemove = await adapter.getItem(key)
    expect(afterRemove).toBeNull()
  })
})
