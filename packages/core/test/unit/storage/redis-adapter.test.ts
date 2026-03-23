import { describe, expect, it } from 'vitest'
import { createRedisAdapter } from '../../../src/storage/redis-adapter'
import { createMockRedis } from './mock-redis'

describe('createRedisAdapter', () => {
  it('should store and retrieve values via JSON serialization', async () => {
    const redis = createMockRedis()
    const adapter = createRedisAdapter(redis)

    const value = { count: 42, nested: { active: true } }
    await adapter.setItem('test-key', value)
    const result = await adapter.getItem('test-key')

    expect(result).toEqual(value)
  })

  it('should return null for missing keys', async () => {
    const redis = createMockRedis()
    const adapter = createRedisAdapter(redis)

    const result = await adapter.getItem('nonexistent')
    expect(result).toBeNull()
  })

  it('should remove keys', async () => {
    const redis = createMockRedis()
    const adapter = createRedisAdapter(redis)

    await adapter.setItem('to-delete', { value: 1 })
    expect(await adapter.getItem('to-delete')).toEqual({ value: 1 })

    await adapter.removeItem('to-delete')
    expect(await adapter.getItem('to-delete')).toBeNull()
    expect(redis.del).toHaveBeenCalledWith('ai-armor:to-delete')
  })

  it('should apply default key prefix "ai-armor:"', async () => {
    const redis = createMockRedis()
    const adapter = createRedisAdapter(redis)

    await adapter.setItem('my-key', 'hello')

    expect(redis.set).toHaveBeenCalledWith('ai-armor:my-key', '"hello"')
    expect(redis.get).not.toHaveBeenCalled()

    await adapter.getItem('my-key')
    expect(redis.get).toHaveBeenCalledWith('ai-armor:my-key')
  })

  it('should apply custom prefix', async () => {
    const redis = createMockRedis()
    const adapter = createRedisAdapter(redis, { prefix: 'myapp:' })

    await adapter.setItem('counter', 10)
    expect(redis.set).toHaveBeenCalledWith('myapp:counter', '10')

    await adapter.getItem('counter')
    expect(redis.get).toHaveBeenCalledWith('myapp:counter')

    await adapter.removeItem('counter')
    expect(redis.del).toHaveBeenCalledWith('myapp:counter')
  })

  it('should handle empty string prefix', async () => {
    const redis = createMockRedis()
    const adapter = createRedisAdapter(redis, { prefix: '' })

    await adapter.setItem('bare-key', 'value')
    expect(redis.set).toHaveBeenCalledWith('bare-key', '"value"')
  })

  it('should set TTL when configured (verify set called with EX arg)', async () => {
    const redis = createMockRedis()
    const adapter = createRedisAdapter(redis, { ttl: 3600 })

    await adapter.setItem('ephemeral', { data: true })

    expect(redis.set).toHaveBeenCalledWith(
      'ai-armor:ephemeral',
      '{"data":true}',
      'EX',
      3600,
    )
  })

  it('should not set TTL when ttl is 0', async () => {
    const redis = createMockRedis()
    const adapter = createRedisAdapter(redis, { ttl: 0 })

    await adapter.setItem('permanent', 'value')

    expect(redis.set).toHaveBeenCalledWith('ai-armor:permanent', '"value"')
    expect(redis.set).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'EX',
      expect.anything(),
    )
  })

  it('should not set TTL when ttl option is omitted', async () => {
    const redis = createMockRedis()
    const adapter = createRedisAdapter(redis)

    await adapter.setItem('key', 'val')

    expect(redis.set).toHaveBeenCalledWith('ai-armor:key', '"val"')
    expect(redis.set).toHaveBeenCalledTimes(1)
    expect(redis.set.mock.calls[0]).toHaveLength(2)
  })

  it('should handle non-JSON strings gracefully (return raw string)', async () => {
    const redis = createMockRedis()
    const adapter = createRedisAdapter(redis)

    // Simulate a raw string stored directly in Redis (not JSON-encoded)
    redis._store.set('ai-armor:raw-key', 'not-valid-json')

    const result = await adapter.getItem('raw-key')
    expect(result).toBe('not-valid-json')
  })

  it('should re-export createRedisAdapter from redis entry point', async () => {
    const redisExports = await import('../../../src/redis')
    expect(redisExports.createRedisAdapter).toBeDefined()
    expect(typeof redisExports.createRedisAdapter).toBe('function')
  })
})
