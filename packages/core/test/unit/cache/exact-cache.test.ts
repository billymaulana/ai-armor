import type { ArmorRequest } from '../../../src/types'
import { describe, expect, it, vi } from 'vitest'
import { createExactCache } from '../../../src/cache/exact-cache'

function makeRequest(model: string, messages: unknown[] = [{ role: 'user', content: 'hello' }]): ArmorRequest {
  return { model, messages }
}

describe('createExactCache', () => {
  it('should cache and retrieve responses', () => {
    const cache = createExactCache({
      enabled: true,
      strategy: 'exact',
      ttl: 3600,
      driver: 'memory',
    })

    const req = makeRequest('gpt-4o')
    cache.set(req, { content: 'cached response' })

    const result = cache.get(req)
    expect(result).toEqual({ content: 'cached response' })
  })

  it('should return undefined for cache miss', () => {
    const cache = createExactCache({
      enabled: true,
      strategy: 'exact',
      ttl: 3600,
      driver: 'memory',
    })

    const result = cache.get(makeRequest('gpt-4o'))
    expect(result).toBeUndefined()
  })

  it('should differentiate requests by model', () => {
    const cache = createExactCache({
      enabled: true,
      strategy: 'exact',
      ttl: 3600,
      driver: 'memory',
    })

    const req1 = makeRequest('gpt-4o')
    const req2 = makeRequest('gpt-4o-mini')

    cache.set(req1, { content: 'response-1' })
    cache.set(req2, { content: 'response-2' })

    expect(cache.get(req1)).toEqual({ content: 'response-1' })
    expect(cache.get(req2)).toEqual({ content: 'response-2' })
  })

  it('should expire entries after TTL', () => {
    vi.useFakeTimers()

    const cache = createExactCache({
      enabled: true,
      strategy: 'exact',
      ttl: 1, // 1 second
      driver: 'memory',
    })

    const req = makeRequest('gpt-4o')
    cache.set(req, { content: 'response' })

    expect(cache.get(req)).toBeDefined()

    vi.advanceTimersByTime(1100)

    expect(cache.get(req)).toBeUndefined()

    vi.useRealTimers()
  })

  it('should respect maxSize with LRU eviction', () => {
    const cache = createExactCache({
      enabled: true,
      strategy: 'exact',
      ttl: 3600,
      driver: 'memory',
      maxSize: 2,
    })

    cache.set(makeRequest('model-a', [{ content: 'a' }]), { content: 'a' })
    cache.set(makeRequest('model-b', [{ content: 'b' }]), { content: 'b' })
    cache.set(makeRequest('model-c', [{ content: 'c' }]), { content: 'c' })

    // model-a should be evicted (LRU)
    expect(cache.size()).toBe(2)
  })

  it('should not cache when disabled', () => {
    const cache = createExactCache({
      enabled: false,
      strategy: 'exact',
      ttl: 3600,
      driver: 'memory',
    })

    const req = makeRequest('gpt-4o')
    cache.set(req, { content: 'response' })

    expect(cache.get(req)).toBeUndefined()
    expect(cache.size()).toBe(0)
  })

  it('should use custom keyFn when provided', () => {
    const cache = createExactCache({
      enabled: true,
      strategy: 'exact',
      ttl: 3600,
      driver: 'memory',
      keyFn: req => `custom:${req.model}`,
    })

    const req1 = makeRequest('gpt-4o', [{ content: 'hello' }])
    const req2 = makeRequest('gpt-4o', [{ content: 'different' }])

    cache.set(req1, { content: 'first' })

    // Same custom key, so should return cached value
    expect(cache.get(req2)).toEqual({ content: 'first' })
  })

  it('should clear all entries', () => {
    const cache = createExactCache({
      enabled: true,
      strategy: 'exact',
      ttl: 3600,
      driver: 'memory',
    })

    cache.set(makeRequest('model-a'), { content: 'a' })
    cache.set(makeRequest('model-b'), { content: 'b' })

    expect(cache.size()).toBe(2)

    cache.clear()
    expect(cache.size()).toBe(0)
  })

  it('should report has() correctly', () => {
    const cache = createExactCache({
      enabled: true,
      strategy: 'exact',
      ttl: 3600,
      driver: 'memory',
    })

    const req = makeRequest('gpt-4o')
    expect(cache.has(req)).toBe(false)

    cache.set(req, { content: 'response' })
    expect(cache.has(req)).toBe(true)
  })

  it('should evict expired entries when calling size()', () => {
    vi.useFakeTimers()

    const cache = createExactCache({
      enabled: true,
      strategy: 'exact',
      ttl: 1, // 1 second
      driver: 'memory',
    })

    cache.set(makeRequest('model-a', [{ content: 'a' }]), { content: 'a' })
    cache.set(makeRequest('model-b', [{ content: 'b' }]), { content: 'b' })

    expect(cache.size()).toBe(2)

    // Advance time past TTL
    vi.advanceTimersByTime(1100)

    // size() triggers evictExpired, should remove both expired entries
    expect(cache.size()).toBe(0)

    vi.useRealTimers()
  })
})
