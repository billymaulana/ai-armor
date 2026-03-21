import { describe, expect, it } from 'vitest'
import { createArmor } from '../../src/create-armor'
import { aiArmorMiddleware } from '../../src/middleware/ai-sdk'

describe('aiArmorMiddleware', () => {
  it('should create middleware with armor instance', () => {
    const armor = createArmor({
      routing: { aliases: { fast: 'gpt-4o-mini' } },
    })

    const middleware = aiArmorMiddleware(armor, { userId: 'test-user' })
    expect(middleware.transformParams).toBeDefined()
    expect(middleware.wrapGenerate).toBeDefined()
  })

  it('should resolve model aliases in transformParams', async () => {
    const armor = createArmor({
      routing: { aliases: { fast: 'gpt-4o-mini' } },
    })

    const middleware = aiArmorMiddleware(armor)
    const result = await middleware.transformParams({
      params: { model: 'fast', messages: [] },
    })

    expect(result.model).toBe('gpt-4o-mini')
  })

  it('should throw when rate limited', async () => {
    const armor = createArmor({
      rateLimit: {
        strategy: 'sliding-window',
        rules: [{ key: 'user', limit: 1, window: '1m' }],
      },
    })

    const middleware = aiArmorMiddleware(armor, { userId: 'user-1' })

    // First request passes
    await middleware.transformParams({ params: { model: 'gpt-4o', messages: [] } })

    // Second request should fail
    await expect(
      middleware.transformParams({ params: { model: 'gpt-4o', messages: [] } }),
    ).rejects.toThrow('[ai-armor] Rate limited')
  })

  it('should throw when budget exceeded with block action', async () => {
    const armor = createArmor({
      budget: {
        daily: 0.001,
        onExceeded: 'block',
      },
    })

    // Manually track cost to exceed budget
    await armor.trackCost('gpt-4o', 10000, 5000)

    const middleware = aiArmorMiddleware(armor)

    await expect(
      middleware.transformParams({ params: { model: 'gpt-4o', messages: [] } }),
    ).rejects.toThrow('[ai-armor] Budget exceeded')
  })

  it('should downgrade model when budget exceeded with downgrade action', async () => {
    const armor = createArmor({
      budget: {
        daily: 0.001,
        onExceeded: 'downgrade-model',
        downgradeMap: { 'gpt-4o': 'gpt-4o-mini' },
      },
    })

    await armor.trackCost('gpt-4o', 10000, 5000)

    const middleware = aiArmorMiddleware(armor)
    const result = await middleware.transformParams({
      params: { model: 'gpt-4o', messages: [] },
    })

    expect(result.model).toBe('gpt-4o-mini')
  })

  it('should use cached response when available', async () => {
    const armor = createArmor({
      cache: {
        enabled: true,
        strategy: 'exact',
        ttl: 3600,
        driver: 'memory',
      },
    })

    // Pre-populate cache
    armor.setCachedResponse(
      { model: 'gpt-4o', messages: [{ content: 'hello' }] },
      { content: 'cached response' },
    )

    const middleware = aiArmorMiddleware(armor)
    const transformed = await middleware.transformParams({
      params: { model: 'gpt-4o', messages: [{ content: 'hello' }] },
    })

    expect(transformed._armorCached).toBeDefined()
  })

  it('should track cost and log after generation', async () => {
    const armor = createArmor({
      logging: {
        enabled: true,
        include: ['model', 'tokens', 'cost', 'latency'],
      },
    })

    const middleware = aiArmorMiddleware(armor, { userId: 'test-user' })

    const mockResult = {
      usage: { promptTokens: 100, completionTokens: 50 },
      content: 'Hello!',
    }

    const transformed = await middleware.transformParams({
      params: { model: 'gpt-4o', messages: [] },
    })

    await middleware.wrapGenerate({
      doGenerate: async () => mockResult,
      params: transformed,
    })

    const logs = armor.getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0]!.model).toBe('gpt-4o')
    expect(logs[0]!.inputTokens).toBe(100)
    expect(logs[0]!.outputTokens).toBe(50)
    expect(logs[0]!.cached).toBe(false)
    expect(logs[0]!.userId).toBe('test-user')
  })

  it('should log and rethrow when doGenerate throws', async () => {
    const armor = createArmor({
      logging: {
        enabled: true,
        include: ['model', 'latency'],
      },
    })

    const middleware = aiArmorMiddleware(armor, { userId: 'test-user' })
    const transformed = await middleware.transformParams({
      params: { model: 'gpt-4o', messages: [] },
    })

    await expect(
      middleware.wrapGenerate({
        doGenerate: async () => { throw new Error('API timeout') },
        params: transformed,
      }),
    ).rejects.toThrow('API timeout')

    const logs = armor.getLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0]!.blocked).toBe('Error: API timeout')
    expect(logs[0]!.cost).toBe(0)
  })
})
