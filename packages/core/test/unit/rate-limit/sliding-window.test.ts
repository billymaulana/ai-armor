import { describe, expect, it, vi } from 'vitest'
import { createSlidingWindowLimiter, parseWindow } from '../../../src/rate-limit/sliding-window'

describe('parseWindow', () => {
  it('should parse seconds', () => {
    expect(parseWindow('30s')).toBe(30_000)
  })

  it('should parse minutes', () => {
    expect(parseWindow('1m')).toBe(60_000)
    expect(parseWindow('5m')).toBe(300_000)
  })

  it('should parse hours', () => {
    expect(parseWindow('1h')).toBe(3_600_000)
  })

  it('should parse days', () => {
    expect(parseWindow('1d')).toBe(86_400_000)
  })

  it('should throw on invalid format', () => {
    expect(() => parseWindow('invalid')).toThrow('Invalid window format')
    expect(() => parseWindow('1x')).toThrow('Invalid window format')
    expect(() => parseWindow('')).toThrow('Invalid window format')
  })

  it('should throw on zero window', () => {
    expect(() => parseWindow('0s')).toThrow('must be greater than 0')
    expect(() => parseWindow('0m')).toThrow('must be greater than 0')
  })
})

describe('createSlidingWindowLimiter', () => {
  it('should allow requests within limit', async () => {
    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [{ key: 'user', limit: 3, window: '1m' }],
    })

    const ctx = { userId: 'user-1' }

    const r1 = await limiter.check(ctx)
    expect(r1.allowed).toBe(true)
    expect(r1.remaining).toBe(2)

    const r2 = await limiter.check(ctx)
    expect(r2.allowed).toBe(true)
    expect(r2.remaining).toBe(1)

    const r3 = await limiter.check(ctx)
    expect(r3.allowed).toBe(true)
    expect(r3.remaining).toBe(0)
  })

  it('should block requests exceeding limit', async () => {
    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [{ key: 'user', limit: 2, window: '1m' }],
    })

    const ctx = { userId: 'user-1' }

    await limiter.check(ctx)
    await limiter.check(ctx)

    const result = await limiter.check(ctx)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('should track different users independently', async () => {
    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [{ key: 'user', limit: 1, window: '1m' }],
    })

    const r1 = await limiter.check({ userId: 'user-1' })
    expect(r1.allowed).toBe(true)

    const r2 = await limiter.check({ userId: 'user-2' })
    expect(r2.allowed).toBe(true)

    const r3 = await limiter.check({ userId: 'user-1' })
    expect(r3.allowed).toBe(false)
  })

  it('should call onLimited callback when rate limited', async () => {
    const onLimited = vi.fn()
    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [{ key: 'user', limit: 1, window: '1m' }],
      onLimited,
    })

    const ctx = { userId: 'user-1' }
    await limiter.check(ctx)
    await limiter.check(ctx)

    expect(onLimited).toHaveBeenCalledOnce()
    expect(onLimited).toHaveBeenCalledWith(ctx)
  })

  it('should allow requests after window expires', async () => {
    vi.useFakeTimers()

    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [{ key: 'user', limit: 1, window: '1s' }],
    })

    const ctx = { userId: 'user-1' }

    const r1 = await limiter.check(ctx)
    expect(r1.allowed).toBe(true)

    const r2 = await limiter.check(ctx)
    expect(r2.allowed).toBe(false)

    // Advance past the window
    vi.advanceTimersByTime(1100)

    const r3 = await limiter.check(ctx)
    expect(r3.allowed).toBe(true)

    vi.useRealTimers()
  })

  it('should use keyResolver when provided', async () => {
    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [{ key: 'user', limit: 1, window: '1m' }],
      keyResolver: (ctx, _ruleKey) => ctx.headers?.['x-api-key'] as string ?? 'default',
    })

    const r1 = await limiter.check({ headers: { 'x-api-key': 'key-1' } })
    expect(r1.allowed).toBe(true)

    const r2 = await limiter.check({ headers: { 'x-api-key': 'key-1' } })
    expect(r2.allowed).toBe(false)

    const r3 = await limiter.check({ headers: { 'x-api-key': 'key-2' } })
    expect(r3.allowed).toBe(true)
  })

  it('should handle multiple rules', async () => {
    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [
        { key: 'user', limit: 5, window: '1m' },
        { key: 'ip', limit: 2, window: '1m' },
      ],
    })

    const ctx = { userId: 'user-1', ip: '1.2.3.4' }

    await limiter.check(ctx)
    await limiter.check(ctx)

    // IP limit hit (2), even though user limit (5) has room
    const result = await limiter.check(ctx)
    expect(result.allowed).toBe(false)
  })

  it('should reset all entries', async () => {
    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [{ key: 'user', limit: 1, window: '1m' }],
    })

    const ctx = { userId: 'user-1' }
    await limiter.check(ctx)

    const blocked = await limiter.check(ctx)
    expect(blocked.allowed).toBe(false)

    limiter.reset()

    const afterReset = await limiter.check(ctx)
    expect(afterReset.allowed).toBe(true)
  })

  it('should provide resetAt timestamp', async () => {
    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [{ key: 'user', limit: 1, window: '1m' }],
    })

    const ctx = { userId: 'user-1' }
    await limiter.check(ctx)

    const result = await limiter.check(ctx)
    expect(result.resetAt).toBeGreaterThan(Date.now())
  })

  it('should throw when store is "redis" without adapter', () => {
    expect(() => createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [{ key: 'user', limit: 1, window: '1m' }],
      store: 'redis',
    })).toThrow('requires passing a StorageAdapter')
  })

  it('should use external StorageAdapter for entries', async () => {
    const storage = new Map<string, unknown>()
    const adapter = {
      getItem: async (key: string) => storage.get(key),
      setItem: async (key: string, value: unknown) => { storage.set(key, value) },
      removeItem: async (key: string) => { storage.delete(key) },
    }

    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [{ key: 'user', limit: 2, window: '1m' }],
      store: adapter,
    })

    const ctx = { userId: 'user-1' }

    const r1 = await limiter.check(ctx)
    expect(r1.allowed).toBe(true)
    expect(storage.size).toBeGreaterThan(0)

    const r2 = await limiter.check(ctx)
    expect(r2.allowed).toBe(true)

    const r3 = await limiter.check(ctx)
    expect(r3.allowed).toBe(false)
  })

  it('should handle external store returning non-array', async () => {
    const adapter = {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    }

    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [{ key: 'user', limit: 2, window: '1m' }],
      store: adapter,
    })

    const result = await limiter.check({ userId: 'user-1' })
    expect(result.allowed).toBe(true)
  })

  it('should resolve ip key from context', async () => {
    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [{ key: 'ip', limit: 1, window: '1m' }],
    })

    const r1 = await limiter.check({ ip: '1.2.3.4' })
    expect(r1.allowed).toBe(true)

    const r2 = await limiter.check({ ip: '1.2.3.4' })
    expect(r2.allowed).toBe(false)
  })

  it('should resolve apiKey key from context', async () => {
    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [{ key: 'apiKey', limit: 1, window: '1m' }],
    })

    const r1 = await limiter.check({ apiKey: 'sk-123' })
    expect(r1.allowed).toBe(true)

    const r2 = await limiter.check({ apiKey: 'sk-123' })
    expect(r2.allowed).toBe(false)
  })

  it('should resolve custom key from context', async () => {
    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [{ key: 'orgId', limit: 1, window: '1m' }],
    })

    const r1 = await limiter.check({ orgId: 'org-1' })
    expect(r1.allowed).toBe(true)

    const r2 = await limiter.check({ orgId: 'org-1' })
    expect(r2.allowed).toBe(false)
  })

  it('should fallback to anonymous when userId is undefined', async () => {
    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [{ key: 'user', limit: 1, window: '1m' }],
    })

    const r1 = await limiter.check({})
    expect(r1.allowed).toBe(true)

    // Same anonymous user
    const r2 = await limiter.check({})
    expect(r2.allowed).toBe(false)
  })

  it('should fallback to unknown when ip is undefined', async () => {
    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [{ key: 'ip', limit: 1, window: '1m' }],
    })

    const r1 = await limiter.check({})
    expect(r1.allowed).toBe(true)

    const r2 = await limiter.check({})
    expect(r2.allowed).toBe(false)
  })

  it('should fallback to unknown when apiKey is undefined', async () => {
    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [{ key: 'apiKey', limit: 1, window: '1m' }],
    })

    const r1 = await limiter.check({})
    expect(r1.allowed).toBe(true)

    const r2 = await limiter.check({})
    expect(r2.allowed).toBe(false)
  })

  it('should return 0 remaining when rules array is empty', async () => {
    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [],
    })

    const result = await limiter.check({ userId: 'user-1' })
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(0)
  })

  it('should not access prototype properties for custom keys', async () => {
    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [{ key: 'toString', limit: 1, window: '1m' }],
    })

    // toString exists on prototype but NOT as own property — should resolve to 'unknown'
    const r1 = await limiter.check({})
    expect(r1.allowed).toBe(true)

    const r2 = await limiter.check({})
    expect(r2.allowed).toBe(false)
  })

  it('should fallback to unknown when own property value is nullish', async () => {
    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [{ key: 'orgId', limit: 1, window: '1m' }],
    })

    // orgId exists as own property but value is undefined
    const r1 = await limiter.check({ orgId: undefined })
    expect(r1.allowed).toBe(true)

    const r2 = await limiter.check({ orgId: undefined })
    expect(r2.allowed).toBe(false)
  })

  it('should use own property for custom key when it exists on context', async () => {
    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [{ key: 'orgId', limit: 1, window: '1m' }],
    })

    // orgId is an own property — should use its value
    const r1 = await limiter.check({ orgId: 'org-a' })
    expect(r1.allowed).toBe(true)

    // Same orgId blocked
    const r2 = await limiter.check({ orgId: 'org-a' })
    expect(r2.allowed).toBe(false)

    // Different orgId allowed
    const r3 = await limiter.check({ orgId: 'org-b' })
    expect(r3.allowed).toBe(true)
  })

  describe('peek', () => {
    it('should return remaining without consuming a request', async () => {
      const limiter = createSlidingWindowLimiter({
        strategy: 'sliding-window',
        rules: [{ key: 'user', limit: 3, window: '1m' }],
      })

      const ctx = { userId: 'user-1' }

      // Consume one request
      await limiter.check(ctx)

      // Peek should show 2 remaining without consuming
      const peek1 = await limiter.peek(ctx)
      expect(peek1.remaining).toBe(2)
      expect(peek1.resetAt).toBeGreaterThan(0)

      // Peek again - still 2 remaining (peek doesn't consume)
      const peek2 = await limiter.peek(ctx)
      expect(peek2.remaining).toBe(2)
    })

    it('should return 0 remaining when fully consumed', async () => {
      const limiter = createSlidingWindowLimiter({
        strategy: 'sliding-window',
        rules: [{ key: 'user', limit: 1, window: '1m' }],
      })

      const ctx = { userId: 'user-1' }
      await limiter.check(ctx)

      const result = await limiter.peek(ctx)
      expect(result.remaining).toBe(0)
      expect(result.resetAt).toBeGreaterThan(0)
    })

    it('should return 0 remaining with empty rules', async () => {
      const limiter = createSlidingWindowLimiter({
        strategy: 'sliding-window',
        rules: [],
      })

      const result = await limiter.peek({ userId: 'user-1' })
      expect(result.remaining).toBe(0)
      expect(result.resetAt).toBe(0)
    })

    it('should handle multiple rules and return minimum remaining', async () => {
      const limiter = createSlidingWindowLimiter({
        strategy: 'sliding-window',
        rules: [
          { key: 'user', limit: 5, window: '1m' },
          { key: 'ip', limit: 2, window: '1m' },
        ],
      })

      const ctx = { userId: 'user-1', ip: '1.2.3.4' }
      await limiter.check(ctx)

      const result = await limiter.peek(ctx)
      // ip limit: 2-1=1, user limit: 5-1=4, minimum is 1
      expect(result.remaining).toBe(1)
    })

    it('should work with external StorageAdapter', async () => {
      const storage = new Map<string, unknown>()
      const adapter = {
        getItem: async (key: string) => storage.get(key),
        setItem: async (key: string, value: unknown) => { storage.set(key, value) },
        removeItem: async (key: string) => { storage.delete(key) },
      }

      const limiter = createSlidingWindowLimiter({
        strategy: 'sliding-window',
        rules: [{ key: 'user', limit: 3, window: '1m' }],
        store: adapter,
      })

      const ctx = { userId: 'user-1' }
      await limiter.check(ctx)
      await limiter.check(ctx)

      const result = await limiter.peek(ctx)
      expect(result.remaining).toBe(1)
    })
  })

  it('should fallback to unknown for custom key when context value is undefined', async () => {
    const limiter = createSlidingWindowLimiter({
      strategy: 'sliding-window',
      rules: [{ key: 'orgId', limit: 1, window: '1m' }],
    })

    const r1 = await limiter.check({})
    expect(r1.allowed).toBe(true)

    const r2 = await limiter.check({})
    expect(r2.allowed).toBe(false)
  })
})
