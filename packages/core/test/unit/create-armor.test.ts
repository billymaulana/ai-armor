import { describe, expect, it } from 'vitest'
import { createArmor } from '../../src/create-armor'

describe('createArmor', () => {
  it('should create an armor instance with config', () => {
    const armor = createArmor({
      routing: {
        aliases: { fast: 'gpt-4o-mini', smart: 'claude-sonnet-4-6' },
      },
    })

    expect(armor.config).toBeDefined()
    expect(armor.config.routing?.aliases).toEqual({
      fast: 'gpt-4o-mini',
      smart: 'claude-sonnet-4-6',
    })
  })

  it('should resolve model aliases', () => {
    const armor = createArmor({
      routing: {
        aliases: { fast: 'gpt-4o-mini', smart: 'claude-sonnet-4-6' },
      },
    })

    expect(armor.resolveModel('fast')).toBe('gpt-4o-mini')
    expect(armor.resolveModel('smart')).toBe('claude-sonnet-4-6')
    expect(armor.resolveModel('gpt-4o')).toBe('gpt-4o')
  })

  it('should return model as-is when no routing configured', () => {
    const armor = createArmor({})
    expect(armor.resolveModel('gpt-4o')).toBe('gpt-4o')
  })

  it('should allow rate limit check when no rate limiting configured', async () => {
    const armor = createArmor({})
    const result = await armor.checkRateLimit({ userId: 'test' })
    expect(result.allowed).toBe(true)
  })

  it('should allow budget check when no budget configured', async () => {
    const armor = createArmor({})
    const result = await armor.checkBudget('gpt-4o', {})
    expect(result.allowed).toBe(true)
    expect(result.action).toBe('pass')
  })

  it('should return empty logs when no logging configured', () => {
    const armor = createArmor({})
    expect(armor.getLogs()).toEqual([])
  })

  it('should return undefined cache when no cache configured', () => {
    const armor = createArmor({})
    expect(armor.getCachedResponse({ model: 'gpt-4o', messages: [] })).toBeUndefined()
  })

  it('should estimate cost for known models', () => {
    const armor = createArmor({})
    const cost = armor.estimateCost('gpt-4o', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(12.50, 1)
  })

  it('should integrate rate limiting', async () => {
    const armor = createArmor({
      rateLimit: {
        strategy: 'sliding-window',
        rules: [{ key: 'user', limit: 2, window: '1m' }],
      },
    })

    const ctx = { userId: 'user-1' }

    const r1 = await armor.checkRateLimit(ctx)
    expect(r1.allowed).toBe(true)

    await armor.checkRateLimit(ctx)

    const r3 = await armor.checkRateLimit(ctx)
    expect(r3.allowed).toBe(false)
  })

  it('should integrate budget checking', async () => {
    const armor = createArmor({
      budget: {
        daily: 0.001,
        onExceeded: 'block',
      },
    })

    await armor.trackCost('gpt-4o', 1000, 500)

    const result = await armor.checkBudget('gpt-4o', {})
    expect(result.allowed).toBe(false)
    expect(result.action).toBe('block')
  })

  it('should integrate caching', () => {
    const armor = createArmor({
      cache: {
        enabled: true,
        strategy: 'exact',
        ttl: 3600,
        driver: 'memory',
      },
    })

    const req = { model: 'gpt-4o', messages: [{ content: 'hello' }] }

    expect(armor.getCachedResponse(req)).toBeUndefined()

    armor.setCachedResponse(req, { content: 'response' })

    expect(armor.getCachedResponse(req)).toEqual({ content: 'response' })
  })
})
