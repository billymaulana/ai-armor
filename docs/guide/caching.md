# Response Caching

ai-armor includes an O(1) in-memory LRU cache that eliminates redundant API calls for identical requests. This saves money and reduces latency.

## How It Works

The cache uses **exact-match** strategy: if the same model, messages, temperature, and tools are sent again, the cached response is returned instantly without making an API call.

```ts
import { createArmor } from 'ai-armor'

const armor = createArmor({
  cache: {
    enabled: true,
    strategy: 'exact',
    ttl: 3600, // Cache entries expire after 1 hour
    maxSize: 1000, // Keep at most 1000 entries
  },
})
```

## Configuration

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `enabled` | `boolean` | Yes | -- | Enable or disable caching |
| `strategy` | `'exact'` | Yes | -- | Cache matching strategy (exact match only) |
| `ttl` | `number` | Yes | -- | Time-to-live in seconds |
| `maxSize` | `number` | No | unlimited | Maximum cache entries before LRU eviction |
| `keyFn` | `function` | No | -- | Custom cache key generator |

## Basic Usage

```ts
const request = {
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'What is TypeScript?' }],
}

// Check cache before calling the API
const cached = await armor.getCachedResponse(request)
if (cached) {
  return cached // Instant response, no API call
}

// Make the API call...
const response = await callAI(request)

// Store in cache for future identical requests
await armor.setCachedResponse(request, response)
```

## TTL Configuration

The `ttl` field sets how long cached responses remain valid, in seconds:

```ts
// Short TTL for dynamic content
const shortTtl = { enabled: true, strategy: 'exact' as const, ttl: 300 }
// 5 minutes -- good for frequently changing data

// Medium TTL for general use
const mediumTtl = { enabled: true, strategy: 'exact' as const, ttl: 3600 }
// 1 hour -- good balance of freshness and savings

// Long TTL for stable content
const longTtl = { enabled: true, strategy: 'exact' as const, ttl: 86400 }
// 24 hours -- good for factual/reference queries
```

Expired entries are removed lazily on access and during eviction cycles.

## LRU Eviction

When `maxSize` is set, the cache uses **Least Recently Used** eviction. When the cache is full and a new entry is added, the least recently accessed entry is removed.

```ts
const cache = {
  enabled: true,
  strategy: 'exact' as const,
  ttl: 3600,

  maxSize: 500, // Keep 500 most-recently-used entries
}
```

::: info O(1) Implementation
The cache achieves O(1) for both reads and writes using JavaScript's `Map` insertion-order trick. `Map` preserves insertion order, so:

- **Read (get)**: Delete the entry and re-insert it, moving it to the end (most recently used).
- **Evict**: Iterate from the start of the Map -- the first entry is always the LRU candidate.

This avoids the complexity of a separate doubly-linked list that traditional LRU implementations require.
:::

## Custom Key Function

By default, the cache key is a JSON serialization of `{ model, messages, temperature, tools }`. For custom matching logic, provide a `keyFn`:

```ts
const cache = {
  enabled: true,
  strategy: 'exact' as const,
  ttl: 3600,

  keyFn: (request: { model: string, messages: { content: string }[] }) => {
    // Only cache by model + first message content (ignore temperature)
    const firstMessage = request.messages[0] as { content: string }
    return `${request.model}:${firstMessage.content}`
  },
}
```

Use cases for custom key functions:

- **Ignore temperature**: Cache hits even when temperature differs
- **Normalize messages**: Trim whitespace, lowercase, etc.
- **Hash long prompts**: Use a hash instead of full serialization for large prompts
- **Namespace by user**: Include user ID in the key to prevent cross-user cache hits

## When to Use Caching

Caching works best for:

- **FAQ / common queries** -- Users often ask the same questions
- **Translation** -- Same source text produces the same translation
- **Classification** -- Identical inputs always produce the same category
- **Code generation** -- Same prompt produces the same code

::: warning When NOT to Cache
Avoid caching when:

- **Creative/random outputs are needed** -- Caching defeats the purpose of temperature > 0
- **Context changes frequently** -- Conversations with chat history are unlikely to hit cache
- **Tool calls** -- If the model uses tools that produce side effects, cached responses may be stale
- **Time-sensitive queries** -- "What time is it?" should not be cached
:::

## Cache with AI SDK Middleware

When using the [AI SDK integration](/integrations/ai-sdk), caching is handled automatically:

```ts
import { openai } from '@ai-sdk/openai'
import { generateText, wrapLanguageModel } from 'ai'
import { createArmor } from 'ai-armor'
import { aiArmorMiddleware } from 'ai-armor/ai-sdk'

const armor = createArmor({
  cache: {
    enabled: true,
    strategy: 'exact',
    ttl: 3600,
    maxSize: 500,
  },
})

const model = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: aiArmorMiddleware(armor, { userId: 'user-1' }),
})

// First call: hits the API
const result1 = await generateText({ model, prompt: 'What is TypeScript?' })

// Second identical call: returns cached response instantly
const result2 = await generateText({ model, prompt: 'What is TypeScript?' })
```

The middleware automatically:
1. Checks the cache in `transformParams`
2. Stores successful responses in `wrapGenerate`
3. Logs cache hits with `cached: true` in the ArmorLog

## Full Example

```ts
import { createArmor } from 'ai-armor'

const armor = createArmor({
  cache: {
    enabled: true,
    strategy: 'exact',
    ttl: 1800, // 30 minutes
    maxSize: 2000, // LRU eviction after 2000 entries
  },
  logging: {
    enabled: true,
    include: ['model', 'cost', 'cached', 'latency'],
  },
})

async function chat(model: string, message: string) {
  const request = { model, messages: [{ role: 'user', content: message }] }

  // Check cache first
  const cached = await armor.getCachedResponse(request)
  if (cached) {
    // eslint-disable-next-line no-console
    console.log('Cache hit! No API call needed.')
    return cached
  }

  // Call the API
  const start = Date.now()
  const response = await callAI(request)
  const latency = Date.now() - start

  // Cache the response
  await armor.setCachedResponse(request, response)

  // eslint-disable-next-line no-console
  console.log(`API call: ${latency}ms, cached for future use`)
  return response
}

// Measure cache effectiveness
function cacheStats() {
  const logs = armor.getLogs()
  const total = logs.length
  const hits = logs.filter(l => l.cached).length
  const savings = logs.filter(l => l.cached).reduce((s, l) => s + l.cost, 0)

  return {
    totalRequests: total,
    cacheHits: hits,
    hitRate: total > 0 ? `${((hits / total) * 100).toFixed(1)}%` : '0%',
    costSaved: `$${savings.toFixed(4)}`,
  }
}
```

## Related

- [Cost Tracking](/guide/cost-tracking) -- Caching reduces costs
- [Logging](/guide/logging) -- Track cache hit rates
- [AI SDK Integration](/integrations/ai-sdk) -- Automatic caching via middleware
- [API Reference: createArmor](/api/create-armor) -- Full CacheConfig options
