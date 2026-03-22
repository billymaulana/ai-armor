import type { ArmorRequest } from '../../../src/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFallbackChain } from '../../../src/fallback/chain'

export function makeRequest(model: string): ArmorRequest {
  return { model, messages: [{ role: 'user', content: 'hello' }] }
}

describe('createFallbackChain', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('should succeed with first provider', async () => {
    const chain = createFallbackChain({
      chains: { 'gpt-4o': ['gpt-4o', 'claude-sonnet-4-6'] },
    })
    const handler = vi.fn().mockResolvedValue('ok')
    const result = await chain.execute(makeRequest('gpt-4o'), handler)

    expect(result.result).toBe('ok')
    expect(result.model).toBe('gpt-4o')
    expect(result.fallbackUsed).toBe(false)
    expect(handler).toHaveBeenCalledWith('gpt-4o')
  })

  it('should fallback to second provider when first fails', async () => {
    const chain = createFallbackChain({
      chains: { 'gpt-4o': ['gpt-4o', 'claude-sonnet-4-6'] },
    })
    const handler = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok')

    const result = await chain.execute(makeRequest('gpt-4o'), handler)
    expect(result.result).toBe('ok')
    expect(result.model).toBe('claude-sonnet-4-6')
    expect(result.fallbackUsed).toBe(true)
  })

  it('should fallback to third when first two fail', async () => {
    const chain = createFallbackChain({
      chains: { 'gpt-4o': ['gpt-4o', 'claude-sonnet-4-6', 'gemini-pro'] },
    })
    const handler = vi.fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockResolvedValueOnce('ok')

    const result = await chain.execute(makeRequest('gpt-4o'), handler)
    expect(result.result).toBe('ok')
    expect(result.model).toBe('gemini-pro')
    expect(result.attempts).toBe(3)
  })

  it('should throw AggregateError when all providers fail', async () => {
    const chain = createFallbackChain({
      chains: { 'gpt-4o': ['gpt-4o', 'claude-sonnet-4-6'] },
    })
    const handler = vi.fn().mockRejectedValue(new Error('fail'))
    await expect(chain.execute(makeRequest('gpt-4o'), handler))
      .rejects
      .toThrow('All providers failed after 2 attempts')
  })

  it('should skip unhealthy providers', async () => {
    const chain = createFallbackChain({
      chains: { 'gpt-4o': ['gpt-4o', 'claude-sonnet-4-6'] },
    })
    const tracker = chain.getHealthTracker()
    tracker.recordFailure('gpt-4o')
    tracker.recordFailure('gpt-4o')
    tracker.recordFailure('gpt-4o')

    const handler = vi.fn().mockResolvedValue('ok')
    const result = await chain.execute(makeRequest('gpt-4o'), handler)
    expect(result.model).toBe('claude-sonnet-4-6')
    expect(result.fallbackUsed).toBe(true)
    expect(handler).toHaveBeenCalledWith('claude-sonnet-4-6')
  })

  it('should keep at least one provider even if all unhealthy', async () => {
    const chain = createFallbackChain({
      chains: { 'gpt-4o': ['gpt-4o', 'claude-sonnet-4-6'] },
    })
    const tracker = chain.getHealthTracker()
    for (const m of ['gpt-4o', 'claude-sonnet-4-6']) {
      tracker.recordFailure(m)
      tracker.recordFailure(m)
      tracker.recordFailure(m)
    }

    const handler = vi.fn().mockResolvedValue('ok')
    const result = await chain.execute(makeRequest('gpt-4o'), handler)
    expect(result.model).toBe('gpt-4o')
    expect(handler).toHaveBeenCalledWith('gpt-4o')
  })

  it('should use request.model as single-item chain when not in chains config', async () => {
    const chain = createFallbackChain({ chains: {} })
    const handler = vi.fn().mockResolvedValue('ok')
    const result = await chain.execute(makeRequest('unknown-model'), handler)

    expect(result.model).toBe('unknown-model')
    expect(result.fallbackUsed).toBe(false)
    expect(handler).toHaveBeenCalledWith('unknown-model')
  })

  it('should mark fallbackUsed=false when first provider succeeds', async () => {
    const chain = createFallbackChain({
      chains: { 'gpt-4o': ['gpt-4o', 'claude-sonnet-4-6'] },
    })
    const handler = vi.fn().mockResolvedValue('ok')
    const result = await chain.execute(makeRequest('gpt-4o'), handler)
    expect(result.fallbackUsed).toBe(false)
  })

  it('should mark fallbackUsed=true when fallback provider succeeds', async () => {
    const chain = createFallbackChain({
      chains: { 'gpt-4o': ['gpt-4o', 'claude-sonnet-4-6'] },
    })
    const handler = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok')
    const result = await chain.execute(makeRequest('gpt-4o'), handler)
    expect(result.fallbackUsed).toBe(true)
  })

  it('should expose health tracker', () => {
    const chain = createFallbackChain({ chains: {} })
    const tracker = chain.getHealthTracker()
    expect(tracker).toBeDefined()
    expect(typeof tracker.isHealthy).toBe('function')
    expect(typeof tracker.recordSuccess).toBe('function')
    expect(typeof tracker.recordFailure).toBe('function')
  })

  it('should handle handler throwing non-Error values', async () => {
    const chain = createFallbackChain({ chains: { 'gpt-4o': ['gpt-4o'] } })
    const handler = vi.fn().mockRejectedValue('string-error')
    await expect(chain.execute(makeRequest('gpt-4o'), handler))
      .rejects
      .toThrow('All providers failed')
  })

  it('should work with healthCheck disabled', async () => {
    const chain = createFallbackChain({
      chains: { 'gpt-4o': ['gpt-4o'] },
      healthCheck: false,
    })
    const handler = vi.fn().mockResolvedValue('ok')
    const result = await chain.execute(makeRequest('gpt-4o'), handler)
    expect(result.result).toBe('ok')
  })
})
