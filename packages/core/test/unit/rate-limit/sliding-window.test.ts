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
})
