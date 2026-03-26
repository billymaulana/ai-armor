/**
 * Example: ai-armor as Express/Connect HTTP middleware
 *
 * Adds rate limiting, budget checks, and caching as middleware
 * for any AI API proxy server.
 *
 * npm install ai-armor express
 */

import { createArmor } from 'ai-armor'
import { createArmorHandler } from 'ai-armor/http'
import express from 'express'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [
      { key: 'user', limit: 30, window: '1m' },
      { key: 'ip', limit: 100, window: '1m' },
    ],
  },
  budget: {
    daily: 200.0,
    perUser: 25.0,
    onExceeded: 'block',
  },
  cache: {
    enabled: true,
    strategy: 'exact',
    ttl: 1800,
    maxSize: 2000,
  },
  routing: {
    aliases: {
      fast: 'gpt-4o-mini',
      smart: 'gpt-4o',
      claude: 'claude-sonnet-4-20250514',
    },
  },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency', 'cached', 'userId'],
  },
})

const app = express()
app.use(express.json())

// ai-armor middleware extracts context from headers:
// - x-user-id -> userId
// - x-forwarded-for -> ip
// - x-api-key -> apiKey
const armorMiddleware = createArmorHandler(armor, {
  contextFromRequest: req => ({
    userId: req.headers?.['x-user-id'] as string,
    apiKey: req.headers?.['x-api-key'] as string,
  }),
})

// Apply ai-armor to all AI routes
app.use('/api/ai/*', armorMiddleware)

// Your AI proxy endpoint
app.post('/api/ai/chat', (req, res) => {
  // If we get here, rate limit + budget checks have passed
  // req.body.model has been resolved (aliases expanded)

  // Forward to your AI provider...
  res.json({
    message: `Would forward to ${req.body.model}`,
    note: 'Rate limit, budget, and cache checks passed',
  })
})

// Cost dashboard endpoint
app.get('/api/ai/stats', (_req, res) => {
  const logs = armor.getLogs()
  const totalCost = logs.reduce((sum, log) => sum + log.cost, 0)
  const cachedCount = logs.filter(l => l.cached).length

  res.json({
    totalRequests: logs.length,
    totalCost: `$${totalCost.toFixed(4)}`,
    cachedRequests: cachedCount,
    cacheHitRate: logs.length > 0 ? `${((cachedCount / logs.length) * 100).toFixed(1)}%` : '0%',
  })
})

app.listen(3000, () => {
  // eslint-disable-next-line no-console
  console.log('AI proxy with ai-armor running on http://localhost:3000')
  // eslint-disable-next-line no-console
  console.log('Try: curl -X POST http://localhost:3000/api/ai/chat -H "Content-Type: application/json" -H "x-user-id: demo" -d \'{"model":"fast","messages":[{"role":"user","content":"hello"}]}\'')
})
