# Nuxt Module

`@ai-armor/nuxt` provides a Nuxt module that integrates ai-armor into your Nuxt application with auto-imported composables and server-side protection.

<a href="https://stackblitz.com/github/billymaulana/ai-armor/tree/main/playground-nuxt" target="_blank"><img src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" alt="Open in StackBlitz"></a>

::: tip Interactive Playground
The [Nuxt Playground](https://stackblitz.com/github/billymaulana/ai-armor/tree/main/playground-nuxt) includes a working chat demo with rate limiting, cost tracking, safety guardrails, and a real-time dashboard -- no API key required.
:::

## Installation

```bash
# npm
npm install @ai-armor/nuxt

# pnpm
pnpm add @ai-armor/nuxt

# yarn
yarn add @ai-armor/nuxt
```

## Setup

Add the module to your `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ['@ai-armor/nuxt'],

  aiArmor: {
    rateLimit: {
      strategy: 'sliding-window',
      rules: [
        { key: 'user', limit: 30, window: '1m' },
        { key: 'ip', limit: 100, window: '1m' },
      ],
    },
    budget: {
      daily: 100,
      monthly: 1000,
      perUser: 25,
      onExceeded: 'downgrade-model',
      downgradeMap: {
        'gpt-4o': 'gpt-4o-mini',
        'claude-opus-4-20250514': 'claude-sonnet-4-20250514',
      },
    },
    cache: {
      enabled: true,
      strategy: 'exact',
      ttl: 3600,
    },
    routing: {
      aliases: {
        fast: 'gpt-4o-mini',
        balanced: 'claude-sonnet-4-20250514',
        best: 'claude-opus-4-20250514',
      },
    },
    safety: {
      promptInjection: true,
      maxTokensPerRequest: 4096,
    },
    logging: {
      enabled: true,
      include: ['model', 'tokens', 'cost', 'latency', 'cached', 'userId'],
    },
  },
})
```

All ai-armor configuration is placed under the `aiArmor` key. The options match the core [ArmorConfig](/api/types#armorconfig) interface.

## Auto-Imported Composables

The module auto-imports three composables for use in your Vue components. No manual imports needed.

### useArmorCost

Track real-time cost data in your UI:

```vue
<script setup lang="ts">
const { todayCost, monthCost, budget, isNearLimit, costHistory } = useArmorCost()
</script>

<template>
  <div class="cost-dashboard">
    <div class="stat">
      <span>Today</span>
      <span>${{ todayCost.toFixed(2) }}</span>
    </div>
    <div class="stat">
      <span>This Month</span>
      <span>${{ monthCost.toFixed(2) }}</span>
    </div>
    <div v-if="isNearLimit" class="warning">
      Approaching budget limit!
    </div>
  </div>
</template>
```

**Return values:**

| Ref | Type | Description |
|---|---|---|
| `todayCost` | `Ref<number>` | Current daily spend in USD |
| `monthCost` | `Ref<number>` | Current monthly spend in USD |
| `budget` | `Ref<{ daily: number, monthly: number }>` | Configured budget limits |
| `isNearLimit` | `Ref<boolean>` | Whether spend is approaching the limit |
| `costHistory` | `Ref<Array<{ date: string, cost: number }>>` | Historical cost data |

### useArmorStatus

Monitor the health and status of your AI endpoints:

```vue
<script setup lang="ts">
const { activeProvider, isHealthy, fallbackActive, rateLimitRemaining } = useArmorStatus()
</script>

<template>
  <div class="status-panel">
    <span :class="isHealthy ? 'text-green' : 'text-red'">
      {{ activeProvider }} -- {{ isHealthy ? 'Healthy' : 'Degraded' }}
    </span>
    <span v-if="fallbackActive" class="text-yellow">Fallback active</span>
    <span>Rate limit remaining: {{ rateLimitRemaining }}</span>
  </div>
</template>
```

**Return values:**

| Ref | Type | Description |
|---|---|---|
| `activeProvider` | `Ref<string>` | Currently active AI provider |
| `isHealthy` | `Ref<boolean>` | Whether the provider is responding normally |
| `fallbackActive` | `Ref<boolean>` | Whether a fallback provider is being used |
| `rateLimitRemaining` | `Ref<number>` | Remaining requests before rate limit |

### useArmorSafety

Track safety-related events:

```vue
<script setup lang="ts">
const { lastBlocked, blockReason } = useArmorSafety()
</script>

<template>
  <div v-if="lastBlocked" class="safety-alert">
    Request blocked: {{ blockReason }}
  </div>
</template>
```

**Return values:**

| Ref | Type | Description |
|---|---|---|
| `lastBlocked` | `Ref<string \| null>` | Timestamp of last blocked request |
| `blockReason` | `Ref<string \| null>` | Reason the request was blocked |

## Server Route Integration

Use ai-armor in your Nuxt server routes for full protection:

```ts
import { openai } from '@ai-sdk/openai'
import { generateText, wrapLanguageModel } from 'ai'
// server/api/chat.post.ts
import { createArmor } from 'ai-armor'
import { aiArmorMiddleware } from 'ai-armor/ai-sdk'

// Create armor instance (ideally in a shared server utility)
const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 30, window: '1m' }],
  },
  budget: {
    daily: 100,
    onExceeded: 'downgrade-model',
    downgradeMap: { 'gpt-4o': 'gpt-4o-mini' },
  },
  cache: { enabled: true, strategy: 'exact', ttl: 3600 },
  logging: { enabled: true, include: ['model', 'tokens', 'cost', 'latency'] },
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const userId = event.headers.get('x-user-id') ?? 'anonymous'

  const protectedModel = wrapLanguageModel({
    model: openai('gpt-4o'),
    middleware: aiArmorMiddleware(armor, { userId }),
  })

  try {
    const { text } = await generateText({
      model: protectedModel,
      prompt: body.prompt,
    })

    return { text }
  }
  catch (error) {
    if (error instanceof Error && error.message.includes('[ai-armor]')) {
      throw createError({
        statusCode: 429,
        statusMessage: error.message,
      })
    }
    throw error
  }
})
```

::: tip Shared Armor Instance
Create the armor instance in `server/utils/armor.ts` and import it across all server routes to share rate limit state and cache:

```ts
// server/utils/armor.ts
import { createArmor } from 'ai-armor'

export const armor = createArmor({
  // ... your config
})
```

Nuxt auto-imports from `server/utils/`, so you can use `armor` directly in any server route.
:::

## Building a Cost Dashboard Page

Combine the composables to build a full cost dashboard:

```vue
<!-- pages/admin/ai-costs.vue -->
<script setup lang="ts">
const { todayCost, monthCost, budget, costHistory } = useArmorCost()
const { activeProvider, isHealthy } = useArmorStatus()

const dailyUsagePercent = computed(() => {
  if (!budget.value.daily)
    return 0
  return Math.min((todayCost.value / budget.value.daily) * 100, 100)
})

const monthlyUsagePercent = computed(() => {
  if (!budget.value.monthly)
    return 0
  return Math.min((monthCost.value / budget.value.monthly) * 100, 100)
})
</script>

<template>
  <div class="p-8 max-w-4xl mx-auto">
    <h1 class="text-2xl font-bold mb-6">
      AI Cost Dashboard
    </h1>

    <!-- Provider Status -->
    <div class="mb-8 p-4 rounded-lg" :class="isHealthy ? 'bg-green-50' : 'bg-red-50'">
      <span class="font-medium">{{ activeProvider }}</span>
      <span class="ml-2">{{ isHealthy ? 'Operational' : 'Degraded' }}</span>
    </div>

    <!-- Budget Gauges -->
    <div class="grid grid-cols-2 gap-6 mb-8">
      <div>
        <h3 class="text-sm font-medium mb-2">
          Daily Budget
        </h3>
        <div class="w-full bg-gray-200 rounded-full h-4">
          <div
            class="h-4 rounded-full"
            :class="dailyUsagePercent > 80 ? 'bg-red-500' : 'bg-blue-500'"
            :style="{ width: `${dailyUsagePercent}%` }"
          />
        </div>
        <p class="text-sm mt-1">
          ${{ todayCost.toFixed(2) }} / ${{ budget.daily }}
        </p>
      </div>
      <div>
        <h3 class="text-sm font-medium mb-2">
          Monthly Budget
        </h3>
        <div class="w-full bg-gray-200 rounded-full h-4">
          <div
            class="h-4 rounded-full"
            :class="monthlyUsagePercent > 80 ? 'bg-red-500' : 'bg-blue-500'"
            :style="{ width: `${monthlyUsagePercent}%` }"
          />
        </div>
        <p class="text-sm mt-1">
          ${{ monthCost.toFixed(2) }} / ${{ budget.monthly }}
        </p>
      </div>
    </div>

    <!-- Cost History -->
    <div>
      <h3 class="text-lg font-medium mb-4">
        Cost History
      </h3>
      <div v-for="entry in costHistory" :key="entry.date" class="flex justify-between py-2 border-b">
        <span>{{ entry.date }}</span>
        <span class="font-mono">${{ entry.cost.toFixed(4) }}</span>
      </div>
    </div>
  </div>
</template>
```

## Module Compatibility

| Requirement | Version |
|---|---|
| Nuxt | >= 3.0.0 |
| ai-armor | Latest |
| Node.js | >= 18 |

## Related

- [Getting Started](/guide/getting-started) -- Core package installation
- [AI SDK Integration](/integrations/ai-sdk) -- Standalone AI SDK middleware
- [Cost Tracking](/guide/cost-tracking) -- Budget configuration
- [Logging](/guide/logging) -- Observability setup
- [API Reference: createArmor](/api/create-armor) -- Full config reference
