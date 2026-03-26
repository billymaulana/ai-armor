# Cost Tracking & Budgets

ai-armor includes a built-in pricing database for 70+ models across 17 providers. Track costs in real time, set budget limits, and automatically downgrade models when budgets are tight.

## How Cost Tracking Works

Every time you call `armor.trackCost()`, ai-armor looks up the model in its pricing database and calculates the exact cost based on input and output token counts:

```
cost = (inputTokens / 1,000,000) * inputPricePerMillion
     + (outputTokens / 1,000,000) * outputPricePerMillion
```

Cost entries are stored with timestamps, allowing ai-armor to calculate daily and monthly totals. Old entries (older than 32 days) are automatically pruned to prevent unbounded memory growth.

```ts
// Track cost after an API call
await armor.trackCost('gpt-4o', 500, 200, 'user-123')

// Estimate cost before making a call
const estimated = armor.estimateCost('gpt-4o', 500, 200)
// eslint-disable-next-line no-console
console.log(`Estimated cost: $${estimated.toFixed(6)}`)
// => Estimated cost: $0.003250
```

## Budget Configuration

Configure daily, monthly, and per-user budget limits:

```ts
import { createArmor } from 'ai-armor'

const armor = createArmor({
  budget: {
    daily: 50, // $50/day total
    monthly: 500, // $500/month total
    perUser: 10, // $10/day per user
    onExceeded: 'block',
  },
})
```

### Budget Fields

| Field | Type | Description |
|---|---|---|
| `daily` | `number` | Maximum daily spend in USD. Resets at midnight (server time). |
| `monthly` | `number` | Maximum monthly spend in USD. Resets on the 1st of each month. |
| `perUser` | `number` | Maximum daily spend per user in USD. Requires `ctx.userId`. |
| `onExceeded` | `string` | Action when budget is exceeded: `'block'`, `'warn'`, or `'downgrade-model'`. |

## Budget Actions

### `'block'` -- Reject the request

```ts
const armor = createArmor({
  budget: {
    daily: 50,
    onExceeded: 'block',
  },
})

const result = await armor.checkBudget('gpt-4o', { userId: 'user-1' })
if (!result.allowed) {
  // result.action === 'block'
  throw new Error('Budget exceeded -- request blocked')
}
```

### `'warn'` -- Allow but fire callback

```ts
const armor = createArmor({
  budget: {
    daily: 50,
    onExceeded: 'warn',
    onWarned: (ctx, budget) => {
      console.warn(
        `Budget warning for ${ctx.userId}: `
        + `daily=$${budget.daily.toFixed(2)}, monthly=$${budget.monthly.toFixed(2)}`
      )
      // Send Slack alert, email notification, etc.
    },
  },
})

const result = await armor.checkBudget('gpt-4o', { userId: 'user-1' })
// result.allowed === true (request proceeds)
// result.action === 'warn'
// onWarned callback fires with current usage numbers
```

### `'downgrade-model'` -- Auto-switch to cheaper model

This is the most powerful option. When the budget is exceeded, ai-armor suggests a cheaper model based on your `downgradeMap`:

```ts
const armor = createArmor({
  budget: {
    daily: 50,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'gpt-4o': 'gpt-4o-mini', // $2.50/M -> $0.15/M input
      'claude-opus-4-20250514': 'claude-sonnet-4-20250514', // $15/M -> $3/M input
      'gemini-2.5-pro': 'gemini-2.5-flash', // $1.25/M -> $0.15/M input
    },
  },
})

const result = await armor.checkBudget('gpt-4o', { userId: 'user-1' })
if (result.action === 'downgrade-model') {
  // result.allowed === true
  // result.suggestedModel === 'gpt-4o-mini'
  const finalModel = result.suggestedModel ?? 'gpt-4o'
  // Use finalModel for the API call
}
```

::: warning Missing Downgrade Mapping
If `onExceeded` is `'downgrade-model'` but the requested model has no entry in `downgradeMap`, the request is **blocked** (safe default). Always ensure your most-used models have downgrade mappings:

```ts
// BAD: gemini-2.5-pro has no mapping -> requests will be blocked when budget exceeded
const downgradeMap = { 'gpt-4o': 'gpt-4o-mini' }

// GOOD: all production models have mappings
const downgradeMap = {
  'gpt-4o': 'gpt-4o-mini',
  'claude-sonnet-4-20250514': 'claude-haiku-4-5-20251001',
  'gemini-2.5-pro': 'gemini-2.5-flash',
}
```
:::

::: tip Downgrade Chains
You can chain downgrades. When the first downgrade model also exceeds budget, the system suggests the next one in the chain:

```ts
const downgradeMap = {
  'claude-opus-4-20250514': 'claude-sonnet-4-20250514',
  'claude-sonnet-4-20250514': 'claude-haiku-4-5-20251001',
}
// opus -> sonnet -> haiku (progressively cheaper)
```
:::

## Checking Budgets

The `checkBudget()` method returns a result object:

```ts
const result = await armor.checkBudget('gpt-4o', { userId: 'user-1' })
```

| Field | Type | Description |
|---|---|---|
| `allowed` | `boolean` | Whether the request should proceed |
| `action` | `string` | `'pass'`, `'block'`, `'warn'`, or `'downgrade-model'` |
| `suggestedModel` | `string?` | Alternative model (only when action is `'downgrade-model'`) |

Budget checks are evaluated in this order:

1. **Monthly limit** -- checked first (broadest scope)
2. **Daily limit** -- checked second
3. **Per-user limit** -- checked last (narrowest scope)

If no limits are exceeded, the result is `{ allowed: true, action: 'pass' }`.

## onWarned Callback

The `onWarned` callback fires when `onExceeded` is set to `'warn'` and a budget limit is hit:

```ts
const armor = createArmor({
  budget: {
    daily: 50,
    monthly: 500,
    perUser: 10,
    onExceeded: 'warn',
    onWarned: (ctx, budget) => {
      // budget.daily: current daily spend
      // budget.monthly: current monthly spend
      // budget.perUserDaily?: current per-user daily spend (if userId provided)

      // Example: send to monitoring
      metrics.gauge('ai.budget.daily', budget.daily)
      metrics.gauge('ai.budget.monthly', budget.monthly)

      if (budget.perUserDaily) {
        metrics.gauge('ai.budget.per_user', budget.perUserDaily, {
          userId: ctx.userId,
        })
      }
    },
  },
})
```

## Custom Storage for Persistence

By default, cost data is stored in-memory (lost on restart). For production use, pass a `StorageAdapter`:

```ts
import { createArmor, createRedisAdapter } from 'ai-armor'
import Redis from 'ioredis'

const redis = new Redis()

const armor = createArmor({
  budget: {
    daily: 200,
    monthly: 2000,
    onExceeded: 'block',
    store: createRedisAdapter(redis), // Cost data persists across restarts
  },
})
```

::: warning
Using `store: 'redis'` as a string is not supported and will throw an error. Always provide a concrete `StorageAdapter` instance.
:::

## Supported Providers & Models

The pricing database covers 70+ models across these providers:

| Provider | Example Models | Input $/1M | Output $/1M |
|---|---|---|---|
| **OpenAI** | gpt-4o, gpt-4o-mini, o1, o3-mini | $0.15 - $150 | $0.60 - $600 |
| **Anthropic** | claude-opus-4, claude-sonnet-4, claude-haiku-4.5 | $0.25 - $15 | $1.25 - $75 |
| **Google** | gemini-2.5-pro, gemini-2.5-flash, gemini-2.0-flash | $0.075 - $1.25 | $0.30 - $10 |
| **Mistral** | mistral-large, mistral-small, codestral | $0.15 - $2.70 | $0.15 - $8.10 |
| **Cohere** | command-r-plus, command-r | $0.15 - $2.50 | $0.60 - $10 |
| **Meta** | llama-3.3-70b, llama-3.1-405b, llama-3.1-8b | $0.05 - $3.00 | $0.08 - $3.00 |
| **DeepSeek** | deepseek-chat, deepseek-reasoner | $0.14 - $0.55 | $0.28 - $2.19 |
| **xAI** | grok-2, grok-2-mini | $0.20 - $2.00 | $1.00 - $10 |
| **Amazon** | nova-pro, nova-lite, nova-micro | $0.035 - $0.80 | $0.14 - $3.20 |
| **Moonshot** | kimi-k2, kimi-k2.5 | $0.45 - $0.60 | $2.20 - $2.50 |
| **Zhipu** | glm-4.7, glm-5 | $0.39 - $0.72 | $1.75 - $2.30 |
| **Groq** | llama-4-scout, llama3-70b-8192, mixtral-8x7b | $0.11 - $0.59 | $0.20 - $0.79 |
| **Together AI** | Llama-3.3-70B, Llama-4-Scout, Qwen2.5-72B | $0.18 - $0.59 | $0.23 - $0.79 |
| **Fireworks** | qwen3-8b, llama-v3p3-70b | $0.20 - $0.59 | $0.20 - $0.79 |
| **Azure OpenAI** | gpt-4o-azure, gpt-4o-mini-azure | $0.15 - $2.50 | $0.60 - $10 |
| **Perplexity** | sonar-pro, sonar | $1.00 - $3.00 | $1.00 - $15 |
| **Alibaba Qwen** | qwen-plus, qwen2.5-max, qwen2.5-72b | $0.23 - $1.60 | $0.46 - $6.40 |

::: info Unknown Models
If a model is not in the pricing database, `calculateCost()` returns `0` and `estimateCost()` returns `0`. The request is not blocked -- it just won't have cost tracking. You can check model support with the exported `getModelPricing()` function.
:::

## Cost Estimation

Estimate the cost of a request before making it:

```ts
import { calculateCost, createArmor, getAllModels, getModelPricing } from 'ai-armor'

const armor = createArmor({ budget: { daily: 50, onExceeded: 'warn' } })

// Estimate before calling the API
const estimated = armor.estimateCost('gpt-4o', 1000, 500)
// eslint-disable-next-line no-console
console.log(`This request will cost ~$${estimated.toFixed(6)}`)

const pricing = getModelPricing('claude-sonnet-4-20250514')
// { model: 'claude-sonnet-4-20250514', provider: 'anthropic', input: 3.00, output: 15.00 }

const allModels = getAllModels()
// ['gpt-4o', 'gpt-4o-mini', 'claude-opus-4-6', ...]
```

## Full Example

```ts
import { createArmor } from 'ai-armor'

const armor = createArmor({
  budget: {
    daily: 100,
    monthly: 1000,
    perUser: 25,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'gpt-4o': 'gpt-4o-mini',
      'claude-opus-4-20250514': 'claude-sonnet-4-20250514',
      'claude-sonnet-4-20250514': 'claude-haiku-4-5-20251001',
    },
    onWarned: (_ctx, budget) => {
      console.warn(`Daily: $${budget.daily.toFixed(2)} | Monthly: $${budget.monthly.toFixed(2)}`)
    },
  },
  logging: {
    enabled: true,
    include: ['model', 'cost'],
  },
})

async function protectedCall(userId: string, model: string) {
  // 1. Check budget
  const budget = await armor.checkBudget(model, { userId })

  if (!budget.allowed) {
    throw new Error(`Budget exceeded: ${budget.action}`)
  }

  // 2. Use suggested model if downgraded
  const finalModel = budget.suggestedModel ?? model

  // 3. Make API call with finalModel...

  // 4. Track actual cost after call
  await armor.trackCost(finalModel, inputTokens, outputTokens, userId)
}
```

## Related

- [Rate Limiting](/guide/rate-limiting) -- Complements budget controls
- [Model Routing](/guide/model-routing) -- Aliases for model management
- [Logging](/guide/logging) -- Track costs in structured logs
- [API Reference: createArmor](/api/create-armor) -- Full BudgetConfig options
- [Provider Examples](/examples/providers) -- See cost tracking in action per provider
