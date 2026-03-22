# Model Routing & Aliases

ai-armor lets you define human-readable aliases for AI models, making your application code provider-agnostic and easy to update.

## Why Aliases?

Without aliases, model names are scattered throughout your codebase:

```ts
// Fragile: model names hardcoded everywhere
await openai.chat.completions.create({ model: 'gpt-4o-2024-11-20' /* ... */ })
await anthropic.messages.create({ model: 'claude-sonnet-4-20250514' /* ... */ })
```

When a new model version ships, you need to find and update every occurrence. With aliases:

```ts
// Resilient: change the model in one place
const armor = createArmor({
  routing: {
    aliases: {
      fast: 'gpt-4o-mini',
      balanced: 'claude-sonnet-4-20250514',
      best: 'claude-opus-4-20250514',
    },
  },
})

// Application code uses aliases
const model = armor.resolveModel('balanced')
// => 'claude-sonnet-4-20250514'
```

Update one line in your config, and every part of your application uses the new model.

## Configuration

```ts
import { createArmor } from 'ai-armor'

const armor = createArmor({
  routing: {
    aliases: {
      // Tier-based (provider-agnostic)
      fast: 'gpt-4o-mini',
      balanced: 'claude-sonnet-4-20250514',
      best: 'claude-opus-4-20250514',
      reasoning: 'o1',
      cheap: 'gemini-2.0-flash',

      // Provider-specific shortcuts
      openai: 'gpt-4o',
      claude: 'claude-sonnet-4-20250514',
      gemini: 'gemini-2.5-pro',

      // Use-case specific
      code: 'codestral-latest',
      search: 'sonar-pro',
    },
  },
})
```

## resolveModel()

The `resolveModel()` method maps an alias to its target model. If the input is not an alias, it is returned unchanged:

```ts
armor.resolveModel('fast') // => 'gpt-4o-mini'
armor.resolveModel('balanced') // => 'claude-sonnet-4-20250514'
armor.resolveModel('gpt-4o') // => 'gpt-4o' (not an alias, returned as-is)
```

This makes it safe to pass both aliases and real model names through the same code path.

## Tier-Based Aliases

A common pattern is to define performance tiers that abstract away the specific provider:

```ts
const armor = createArmor({
  routing: {
    aliases: {
      fast: 'gpt-4o-mini', // Lowest latency, lowest cost
      balanced: 'claude-sonnet-4-20250514', // Good quality, moderate cost
      best: 'claude-opus-4-20250514', // Highest quality, highest cost
    },
  },
})

// API routes use tiers, not model names
app.post('/api/chat', (req, res) => {
  const tier = req.body.tier ?? 'balanced'
  const model = armor.resolveModel(tier)
  // Use model for the API call
})
```

When you want to switch your "balanced" tier from Claude to GPT, change one line:

```ts
const aliases = {
  balanced: 'gpt-4o', // Switched from Claude to GPT
}
```

No other code changes needed.

## Provider-Agnostic Routing

Combine aliases with [cost tracking](/guide/cost-tracking) downgrade maps for a fully provider-agnostic setup:

```ts
const armor = createArmor({
  routing: {
    aliases: {
      fast: 'gpt-4o-mini',
      balanced: 'claude-sonnet-4-20250514',
      best: 'claude-opus-4-20250514',
    },
  },
  budget: {
    daily: 100,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'claude-opus-4-20250514': 'claude-sonnet-4-20250514',
      'claude-sonnet-4-20250514': 'gpt-4o-mini',
      'gpt-4o': 'gpt-4o-mini',
    },
  },
})

async function chat(tier: string, message: string) {
  // 1. Resolve alias -> real model
  const resolvedModel = armor.resolveModel(tier)

  // 2. Budget check may downgrade further
  const budget = await armor.checkBudget(resolvedModel, { userId: 'user-1' })
  const finalModel = budget.suggestedModel ?? resolvedModel

  // 3. Use finalModel -- could be any provider
  return callAI(finalModel, message)
}
```

The flow: `'best'` -> `'claude-opus-4-20250514'` -> (budget exceeded) -> `'claude-sonnet-4-20250514'`.

## With AI SDK Middleware

The [AI SDK middleware](/integrations/ai-sdk) resolves aliases automatically in `transformParams`:

```ts
import { openai } from '@ai-sdk/openai'
import { generateText, wrapLanguageModel } from 'ai'
import { createArmor } from 'ai-armor'
import { aiArmorMiddleware } from 'ai-armor/ai-sdk'

const armor = createArmor({
  routing: {
    aliases: { smart: 'gpt-4o' },
  },
})

const model = wrapLanguageModel({
  model: openai('smart'), // alias resolved by middleware
  middleware: aiArmorMiddleware(armor),
})

const { text } = await generateText({ model, prompt: 'Hello' })
```

## With HTTP Middleware

The [HTTP middleware](/integrations/ai-sdk) resolves the `model` field in the request body:

```ts
import { createArmorHandler } from 'ai-armor/http'

const handler = createArmorHandler(armor)

// Client sends: { "model": "fast", "messages": [...] }
// After middleware: req.body.model is resolved to 'gpt-4o-mini'
```

## Patterns

### Environment-Based Routing

```ts
const armor = createArmor({
  routing: {
    aliases: {
      default: process.env.NODE_ENV === 'production'
        ? 'claude-sonnet-4-20250514'
        : 'gpt-4o-mini', // Cheaper model for development
    },
  },
})
```

### Feature-Based Routing

```ts
const armor = createArmor({
  routing: {
    aliases: {
      'chat': 'gpt-4o',
      'code-gen': 'codestral-latest',
      'summarize': 'gemini-2.5-flash',
      'search': 'sonar-pro',
      'reasoning': 'o1',
    },
  },
})

// Each feature uses the optimal model
const chatModel = armor.resolveModel('chat')
const codeModel = armor.resolveModel('code-gen')
```

## Related

- [Cost Tracking](/guide/cost-tracking) -- Combine with downgrade maps
- [AI SDK Integration](/integrations/ai-sdk) -- Automatic alias resolution
- [Provider Examples](/examples/providers) -- See routing per provider
- [API Reference: createArmor](/api/create-armor) -- Full RoutingConfig options
