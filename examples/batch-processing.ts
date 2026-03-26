/**
 * Example: Batch AI processing with concurrency control
 *
 * Production pattern for processing a queue of items through AI
 * with ai-armor budget tracking. Processes items concurrently up to
 * a configurable limit and stops gracefully when the budget is exhausted.
 *
 * npm install ai-armor openai
 */

import { createArmor } from 'ai-armor'
import OpenAI from 'openai'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [
      { key: 'user', limit: 60, window: '1m' },
    ],
  },
  budget: {
    daily: 10.0, // Tight budget for batch jobs
    onExceeded: 'block',
  },
  cache: {
    enabled: true,
    strategy: 'exact',
    ttl: 86400, // 24h -- batch results are stable
    maxSize: 10000,
  },
  routing: {
    aliases: {
      batch: 'gpt-4o-mini', // Cost-efficient model for batch work
    },
  },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency', 'cached', 'userId'],
  },
})

const openai = new OpenAI()

// --- Batch item types ---
interface BatchItem {
  id: string
  prompt: string
}

interface BatchResult {
  id: string
  content: string
  cost: number
  cached: boolean
  error?: string
}

// --- Process a single item with armor protection ---
async function processItem(item: BatchItem, model: string, batchUserId: string): Promise<BatchResult> {
  const ctx = { userId: batchUserId }

  // Budget check per item (may exhaust mid-batch)
  const resolvedModel = armor.resolveModel(model)
  const budget = await armor.checkBudget(resolvedModel, ctx)
  if (!budget.allowed) {
    return { id: item.id, content: '', cost: 0, cached: false, error: 'budget_exhausted' }
  }
  const finalModel = budget.suggestedModel ?? resolvedModel

  // Cache check (avoids re-processing on retries)
  const request = { model: finalModel, messages: [{ role: 'user' as const, content: item.prompt }] }
  const cached = armor.getCachedResponse(request)
  if (cached) {
    return { id: item.id, content: (cached as { content: string }).content, cost: 0, cached: true }
  }

  // Rate limit with backoff
  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed) {
    const waitMs = rateLimit.resetAt - Date.now()
    await new Promise(resolve => setTimeout(resolve, Math.max(waitMs, 100)))
  }

  // Call AI provider
  const start = Date.now()
  const completion = await openai.chat.completions.create({
    model: finalModel,
    messages: [{ role: 'user', content: item.prompt }],
    max_tokens: 512,
  })
  const latency = Date.now() - start

  const content = completion.choices[0]?.message?.content ?? ''
  const inputTokens = completion.usage?.prompt_tokens ?? 0
  const outputTokens = completion.usage?.completion_tokens ?? 0
  const cost = armor.estimateCost(finalModel, inputTokens, outputTokens)

  // Track + cache + log
  await armor.trackCost(finalModel, inputTokens, outputTokens, batchUserId)
  armor.setCachedResponse(request, { content })

  await armor.log({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    model: finalModel,
    provider: 'openai',
    inputTokens,
    outputTokens,
    cost,
    latency,
    cached: false,
    fallback: false,
    rateLimited: false,
    userId: batchUserId,
  })

  return { id: item.id, content, cost, cached: false }
}

// --- Concurrent batch processor ---
async function processBatch(
  items: BatchItem[],
  options: { model?: string, concurrency?: number, userId?: string } = {},
): Promise<{ results: BatchResult[], summary: { total: number, completed: number, cached: number, budgetStopped: number, totalCost: number } }> {
  const { model = 'batch', concurrency = 5, userId = 'batch-job' } = options

  const results: BatchResult[] = []
  let budgetStopped = 0

  // Process in chunks for concurrency control
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency)

    const chunkResults = await Promise.all(
      chunk.map(item => processItem(item, model, userId)),
    )

    for (const result of chunkResults) {
      results.push(result)
      if (result.error === 'budget_exhausted') {
        budgetStopped++
      }
    }

    // If any item in this chunk hit budget limit, stop the batch
    if (chunkResults.some(r => r.error === 'budget_exhausted')) {
      // Mark remaining items as skipped
      for (let j = i + concurrency; j < items.length; j++) {
        results.push({
          id: items[j]!.id,
          content: '',
          cost: 0,
          cached: false,
          error: 'skipped_budget_exhausted',
        })
        budgetStopped++
      }
      break
    }
  }

  const completed = results.filter(r => !r.error).length
  const cached = results.filter(r => r.cached).length
  const totalCost = results.reduce((sum, r) => sum + r.cost, 0)

  return {
    results,
    summary: {
      total: items.length,
      completed,
      cached,
      budgetStopped,
      totalCost,
    },
  }
}

// --- Usage ---
async function main() {
  // Simulate a batch of product descriptions to summarize
  const items: BatchItem[] = Array.from({ length: 25 }, (_, i) => ({
    id: `item-${i + 1}`,
    prompt: `Summarize this product in one sentence: Product #${i + 1} is a premium widget.`,
  }))

  // eslint-disable-next-line no-console
  console.log(`Processing ${items.length} items with concurrency=5...`)

  const { summary } = await processBatch(items, {
    model: 'batch',
    concurrency: 5,
    userId: 'batch-product-summaries',
  })

  // eslint-disable-next-line no-console
  console.log('[batch summary]', {
    total: summary.total,
    completed: summary.completed,
    cached: summary.cached,
    budgetStopped: summary.budgetStopped,
    totalCost: `$${summary.totalCost.toFixed(4)}`,
  })
}

main()
