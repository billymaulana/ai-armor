import { describe, expect, it, vi } from 'vitest'
import { createArmor } from '../../src/create-armor'
import { createArmorHandler } from '../../src/http/index'

function createMockReq(overrides?: Record<string, unknown>) {
  return {
    method: 'POST',
    url: '/api/ai/chat',
    headers: {
      'x-user-id': 'test-user',
      'x-forwarded-for': '1.2.3.4',
    },
    body: {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hello' }],
    },
    ...overrides,
  }
}

function createMockRes() {
  const res = {
    statusCode: 200,
    data: null as unknown,
    headers: {} as Record<string, string>,
    status: vi.fn((code: number) => {
      res.statusCode = code
      return res
    }),
    json: vi.fn((data: unknown) => {
      res.data = data
    }),
    setHeader: vi.fn((name: string, value: string) => {
      res.headers[name] = value
    }),
  }
  return res
}

describe('createArmorHandler', () => {
  it('should pass through when all checks pass', async () => {
    const armor = createArmor({
      rateLimit: {
        strategy: 'sliding-window',
        rules: [{ key: 'user', limit: 10, window: '1m' }],
      },
    })

    const handler = createArmorHandler(armor)
    const req = createMockReq()
    const res = createMockRes()
    const next = vi.fn()

    await handler(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('should return 429 when rate limited', async () => {
    const armor = createArmor({
      rateLimit: {
        strategy: 'sliding-window',
        rules: [{ key: 'user', limit: 1, window: '1m' }],
      },
    })

    const handler = createArmorHandler(armor)
    const req = createMockReq()
    const res = createMockRes()

    await handler(req, res, vi.fn())
    // Second request should be blocked
    const res2 = createMockRes()
    await handler(req, res2, vi.fn())

    expect(res2.status).toHaveBeenCalledWith(429)
    expect(res2.json).toHaveBeenCalled()
    expect(res2.data).toHaveProperty('error', 'Rate limit exceeded')
  })

  it('should set rate limit headers', async () => {
    const armor = createArmor({
      rateLimit: {
        strategy: 'sliding-window',
        rules: [{ key: 'user', limit: 10, window: '1m' }],
      },
    })

    const handler = createArmorHandler(armor)
    const req = createMockReq()
    const res = createMockRes()

    await handler(req, res, vi.fn())

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String))
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String))
  })

  it('should return 402 when budget exceeded', async () => {
    const armor = createArmor({
      budget: {
        daily: 0.001,
        onExceeded: 'block',
      },
    })

    await armor.trackCost('gpt-4o', 10000, 5000)

    const handler = createArmorHandler(armor)
    const req = createMockReq()
    const res = createMockRes()

    await handler(req, res, vi.fn())

    expect(res.status).toHaveBeenCalledWith(402)
    expect(res.data).toHaveProperty('error', 'Budget exceeded')
  })

  it('should return cached response', async () => {
    const armor = createArmor({
      cache: {
        enabled: true,
        strategy: 'exact',
        ttl: 3600,

      },
    })

    // Pre-populate cache
    await armor.setCachedResponse(
      { model: 'gpt-4o', messages: [{ role: 'user', content: 'hello' }] },
      { content: 'cached' },
    )

    const handler = createArmorHandler(armor)
    const req = createMockReq()
    const res = createMockRes()

    await handler(req, res, vi.fn())

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.data).toEqual({ content: 'cached' })
  })

  it('should resolve model aliases in request body', async () => {
    const armor = createArmor({
      routing: { aliases: { fast: 'gpt-4o-mini' } },
    })

    const handler = createArmorHandler(armor)
    const req = createMockReq({ body: { model: 'fast', messages: [] } })
    const res = createMockRes()
    const next = vi.fn()

    await handler(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.body.model).toBe('gpt-4o-mini')
  })

  it('should extract context from custom function', async () => {
    const armor = createArmor({
      rateLimit: {
        strategy: 'sliding-window',
        rules: [{ key: 'user', limit: 1, window: '1m' }],
        keyResolver: (ctx, _ruleKey) => ctx.userId ?? 'anon',
      },
    })

    const handler = createArmorHandler(armor, {
      contextFromRequest: req => ({
        userId: (req.headers?.authorization as string)?.replace('Bearer ', ''),
      }),
    })

    const req1 = createMockReq({ headers: { authorization: 'Bearer user-a' } })
    const res1 = createMockRes()
    await handler(req1, res1, vi.fn())

    const req2 = createMockReq({ headers: { authorization: 'Bearer user-b' } })
    const res2 = createMockRes()
    await handler(req2, res2, vi.fn())

    // Different users, both should pass
    expect(res1.status).not.toHaveBeenCalled()
    expect(res2.status).not.toHaveBeenCalled()
  })
})
