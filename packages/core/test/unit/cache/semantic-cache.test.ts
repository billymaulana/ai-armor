import type { ArmorRequest } from '../../../src/types'
import { describe, expect, it, vi } from 'vitest'
import { createSemanticCache } from '../../../src/cache/semantic-cache'

/**
 * Simple deterministic mock: same input = same vector,
 * slightly different input = slightly different vector.
 */
function mockEmbeddingFn(text: string): Promise<number[]> {
  const vec = Array.from({ length: 8 }).fill(0) as number[]
  for (let i = 0; i < text.length; i++) {
    vec[i % 8] += text.charCodeAt(i) / 1000
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0))
  return Promise.resolve(norm > 0 ? vec.map(v => v / norm) : vec)
}

function makeRequest(model: string, content: string): ArmorRequest {
  return { model, messages: [{ role: 'user', content }] }
}

describe('createSemanticCache', () => {
  it('should return undefined for empty cache', async () => {
    const cache = createSemanticCache({
      enabled: true,
      strategy: 'semantic',
      ttl: 3600,
      embeddingFn: mockEmbeddingFn,
    })

    const result = await cache.get(makeRequest('gpt-4o', 'hello'))
    expect(result).toBeUndefined()
  })

  it('should cache and retrieve semantically similar requests', async () => {
    const cache = createSemanticCache({
      enabled: true,
      strategy: 'semantic',
      ttl: 3600,
      embeddingFn: mockEmbeddingFn,
      similarityThreshold: 0.90,
    })

    const req = makeRequest('gpt-4o', 'What is the capital of France?')
    await cache.set(req, { content: 'Paris' })

    // Exact same request should hit
    const result = await cache.get(req)
    expect(result).toEqual({ content: 'Paris' })
  })

  it('should NOT return results below similarity threshold', async () => {
    const cache = createSemanticCache({
      enabled: true,
      strategy: 'semantic',
      ttl: 3600,
      embeddingFn: mockEmbeddingFn,
      similarityThreshold: 0.999,
    })

    const req1 = makeRequest('gpt-4o', 'What is the capital of France?')
    await cache.set(req1, { content: 'Paris' })

    // Very different request should miss with high threshold
    const req2 = makeRequest('gpt-4o', 'Tell me about quantum physics and black holes.')
    const result = await cache.get(req2)
    expect(result).toBeUndefined()
  })

  it('should respect TTL expiration', async () => {
    vi.useFakeTimers()

    const cache = createSemanticCache({
      enabled: true,
      strategy: 'semantic',
      ttl: 1, // 1 second
      embeddingFn: mockEmbeddingFn,
    })

    const req = makeRequest('gpt-4o', 'hello world')
    await cache.set(req, { content: 'cached' })

    expect(await cache.get(req)).toEqual({ content: 'cached' })

    vi.advanceTimersByTime(1100)

    expect(await cache.get(req)).toBeUndefined()

    vi.useRealTimers()
  })

  it('should respect maxSize with LRU eviction', async () => {
    const cache = createSemanticCache({
      enabled: true,
      strategy: 'semantic',
      ttl: 3600,
      embeddingFn: mockEmbeddingFn,
      maxSize: 2,
    })

    await cache.set(makeRequest('m', 'aaaa'), { id: 1 })
    await cache.set(makeRequest('m', 'bbbb'), { id: 2 })
    await cache.set(makeRequest('m', 'cccc'), { id: 3 })

    // Should have evicted the oldest entry, leaving 2
    expect(cache.size()).toBe(2)
  })

  it('should not cache when disabled', async () => {
    const cache = createSemanticCache({
      enabled: false,
      strategy: 'semantic',
      ttl: 3600,
      embeddingFn: mockEmbeddingFn,
    })

    const req = makeRequest('gpt-4o', 'hello')
    await cache.set(req, { content: 'data' })

    expect(await cache.get(req)).toBeUndefined()
    expect(cache.size()).toBe(0)
  })

  it('should use custom keyFn when provided', async () => {
    const cache = createSemanticCache({
      enabled: true,
      strategy: 'semantic',
      ttl: 3600,
      embeddingFn: mockEmbeddingFn,
      keyFn: req => `custom:${req.model}`,
    })

    const req1 = makeRequest('gpt-4o', 'hello')
    const req2 = makeRequest('gpt-4o', 'completely different message')

    await cache.set(req1, { content: 'first' })

    // Same custom key (same model) => same embedding => should hit
    const result = await cache.get(req2)
    expect(result).toEqual({ content: 'first' })
  })

  it('should clear all entries', async () => {
    const cache = createSemanticCache({
      enabled: true,
      strategy: 'semantic',
      ttl: 3600,
      embeddingFn: mockEmbeddingFn,
    })

    await cache.set(makeRequest('m', 'aaa'), { id: 1 })
    await cache.set(makeRequest('m', 'bbb'), { id: 2 })

    expect(cache.size()).toBe(2)

    cache.clear()
    expect(cache.size()).toBe(0)
  })

  it('should report size correctly', async () => {
    const cache = createSemanticCache({
      enabled: true,
      strategy: 'semantic',
      ttl: 3600,
      embeddingFn: mockEmbeddingFn,
    })

    expect(cache.size()).toBe(0)

    await cache.set(makeRequest('m', 'aaa'), { id: 1 })
    expect(cache.size()).toBe(1)

    await cache.set(makeRequest('m', 'bbb'), { id: 2 })
    expect(cache.size()).toBe(2)
  })

  it('should report has() correctly', async () => {
    const cache = createSemanticCache({
      enabled: true,
      strategy: 'semantic',
      ttl: 3600,
      embeddingFn: mockEmbeddingFn,
    })

    const req = makeRequest('gpt-4o', 'hello world')
    expect(await cache.has(req)).toBe(false)

    await cache.set(req, { content: 'cached' })
    expect(await cache.has(req)).toBe(true)
  })
})
