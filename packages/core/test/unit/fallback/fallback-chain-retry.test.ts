import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFallbackChain } from '../../../src/fallback/chain'
import { makeRequest } from './fallback-chain.test'

describe('createFallbackChain — retry & timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('should timeout slow providers', async () => {
    const chain = createFallbackChain({
      chains: { 'gpt-4o': ['gpt-4o'] },
      timeout: 100,
    })
    const handler = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 200, 'late')),
    )

    const catching = chain.execute(makeRequest('gpt-4o'), handler)
      .catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(100)

    const error = await catching as AggregateError
    expect(error).toBeInstanceOf(AggregateError)
    expect((error.errors[0] as Error).message).toBe('Timeout after 100ms')
  })

  it('should use default timeout of 30s', async () => {
    const chain = createFallbackChain({
      chains: { 'gpt-4o': ['gpt-4o'] },
    })
    const handler = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 35_000, 'late')),
    )

    const catching = chain.execute(makeRequest('gpt-4o'), handler)
      .catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(30_000)

    const error = await catching as AggregateError
    expect(error).toBeInstanceOf(AggregateError)
    expect((error.errors[0] as Error).message).toBe('Timeout after 30000ms')
  })

  it('should retry with exponential backoff', async () => {
    const chain = createFallbackChain({
      chains: { 'gpt-4o': ['gpt-4o'] },
      retries: 2,
      backoff: 'exponential',
    })
    const handler = vi.fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockResolvedValueOnce('ok')

    const promise = chain.execute(makeRequest('gpt-4o'), handler)

    // First retry: 1000 * 2^1 = 2000ms
    await vi.advanceTimersByTimeAsync(2000)
    // Second retry: 1000 * 2^2 = 4000ms
    await vi.advanceTimersByTimeAsync(4000)

    const result = await promise
    expect(result.result).toBe('ok')
    expect(result.attempts).toBe(3)
  })

  it('should retry with linear backoff', async () => {
    const chain = createFallbackChain({
      chains: { 'gpt-4o': ['gpt-4o'] },
      retries: 2,
      backoff: 'linear',
    })
    const handler = vi.fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockResolvedValueOnce('ok')

    const promise = chain.execute(makeRequest('gpt-4o'), handler)

    // First retry: 1000 * (1+1) = 2000ms
    await vi.advanceTimersByTimeAsync(2000)
    // Second retry: 1000 * (2+1) = 3000ms
    await vi.advanceTimersByTimeAsync(3000)

    const result = await promise
    expect(result.result).toBe('ok')
    expect(result.attempts).toBe(3)
  })

  it('should track attempts correctly across providers with retries', async () => {
    const chain = createFallbackChain({
      chains: { 'gpt-4o': ['gpt-4o', 'claude-sonnet-4-6', 'gemini-pro'] },
      retries: 1,
    })
    const handler = vi.fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockRejectedValueOnce(new Error('3'))
      .mockResolvedValueOnce('ok')

    const promise = chain.execute(makeRequest('gpt-4o'), handler)

    // Advance for retry backoffs (exponential default: 2000ms each)
    await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(2000)

    const result = await promise
    // gpt-4o: attempt 1 (fail) + retry attempt 2 (fail) = 2
    // claude: attempt 3 (fail) + retry attempt 4 (ok) = 2
    expect(result.attempts).toBe(4)
  })
})
