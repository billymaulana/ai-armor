import type { ArmorRequest, SemanticCacheConfig } from '../types'
import { cosineSimilarity } from './cosine-similarity'

interface SemanticCacheEntry {
  text: string
  embedding: number[]
  value: unknown
  expiresAt: number
}

export function createSemanticCache(config: SemanticCacheConfig) {
  const entries: SemanticCacheEntry[] = []
  const threshold = config.similarityThreshold ?? 0.92

  function extractText(request: ArmorRequest): string {
    if (config.keyFn) {
      return config.keyFn(request)
    }
    return JSON.stringify({ m: request.model, msg: request.messages })
  }

  function evictExpired(): void {
    const now = Date.now()
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i]!.expiresAt <= now) {
        entries.splice(i, 1)
      }
    }
  }

  function evictLRU(): void {
    if (!config.maxSize || config.maxSize <= 0)
      return
    // Remove oldest entries (front of array) until within limit
    while (entries.length > config.maxSize) {
      entries.shift()
    }
  }

  async function get(request: ArmorRequest): Promise<unknown | undefined> {
    if (!config.enabled)
      return undefined

    evictExpired()

    const text = extractText(request)
    let queryEmbedding: number[]
    try {
      queryEmbedding = await config.embeddingFn(text)
    }
    catch {
      return undefined
    }

    let bestMatch: SemanticCacheEntry | undefined
    let bestSimilarity = -1

    for (const entry of entries) {
      const similarity = cosineSimilarity(queryEmbedding, entry.embedding)
      if (similarity >= threshold && similarity > bestSimilarity) {
        bestSimilarity = similarity
        bestMatch = entry
      }
    }

    if (!bestMatch)
      return undefined

    // Move to end (most recently used) - remove and re-push
    const idx = entries.indexOf(bestMatch)
    if (idx !== -1) {
      entries.splice(idx, 1)
      entries.push(bestMatch)
    }

    return bestMatch.value
  }

  async function set(request: ArmorRequest, value: unknown): Promise<void> {
    if (!config.enabled)
      return

    const text = extractText(request)
    let embedding: number[]
    try {
      embedding = await config.embeddingFn(text)
    }
    catch {
      return
    }

    entries.push({
      text,
      embedding,
      value,
      expiresAt: Date.now() + (config.ttl * 1000),
    })

    evictLRU()
  }

  function has(request: ArmorRequest): Promise<boolean> {
    return get(request).then(v => v !== undefined)
  }

  function size(): number {
    evictExpired()
    return entries.length
  }

  function clear(): void {
    entries.length = 0
  }

  return {
    get,
    set,
    has,
    size,
    clear,
  }
}
