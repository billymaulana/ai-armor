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
const { todayCost, monthCost, budget, isNearLimit, costHistory, refresh, pending, error } = useArmorCost()
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
| `todayCost` | `ComputedRef<number>` | Current daily spend in USD |
| `monthCost` | `ComputedRef<number>` | Current monthly spend in USD |
| `budget` | `ComputedRef<{ daily: number, monthly: number }>` | Configured budget limits |
| `isNearLimit` | `ComputedRef<boolean>` | Whether spend is approaching the limit |
| `costHistory` | `ComputedRef<Array<{ date: string, cost: number }>>` | Historical cost data |
| `refresh` | `() => Promise<void>` | Re-fetch cost data from the server |
| `pending` | `Ref<boolean>` | Whether a fetch is in progress |
| `error` | `Ref<Error \| null>` | Error from the last fetch attempt |

### useArmorStatus

Monitor the health and status of your AI endpoints:

```vue
<script setup lang="ts">
const { isHealthy, rateLimitRemaining, rateLimitResetAt, refresh, pending, error } = useArmorStatus()
</script>

<template>
  <div class="status-panel">
    <span :class="isHealthy ? 'text-green' : 'text-red'">
      {{ isHealthy ? 'Healthy' : 'Degraded' }}
    </span>
    <span>Rate limit remaining: {{ rateLimitRemaining }}</span>
    <span v-if="rateLimitResetAt">Resets at: {{ rateLimitResetAt }}</span>
    <button :disabled="pending" @click="refresh">
      Refresh
    </button>
    <span v-if="error" class="text-red">{{ error.message }}</span>
  </div>
</template>
```

**Return values:**

| Ref | Type | Description |
|---|---|---|
| `isHealthy` | `ComputedRef<boolean>` | Whether the provider is responding normally |
| `rateLimitRemaining` | `ComputedRef<number>` | Remaining requests before rate limit |
| `rateLimitResetAt` | `ComputedRef<string \| null>` | ISO timestamp when the rate limit resets |
| `refresh` | `() => Promise<void>` | Re-fetch status data from the server |
| `pending` | `Ref<boolean>` | Whether a fetch is in progress |
| `error` | `Ref<Error \| null>` | Error from the last fetch attempt |

### useArmorSafety

Check text against safety guardrails before sending to an AI provider. This is an active composable -- you call `checkText()` to run a safety check:

```vue
<script setup lang="ts">
const { checkText, lastCheck, isBlocked, reason, details, blockCount, reset, pending, error } = useArmorSafety()

const userInput = ref('')

async function handleSubmit() {
  await checkText(userInput.value)

  if (isBlocked.value) {
    // Input was flagged -- do not send to AI
    return
  }

  // Safe to proceed with AI request
  await $fetch('/api/chat', { method: 'POST', body: { prompt: userInput.value } })
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <textarea v-model="userInput" placeholder="Enter your prompt..." />
    <button type="submit" :disabled="pending">
      Send
    </button>
  </form>

  <div v-if="isBlocked" class="safety-alert text-red">
    <p>Request blocked: {{ reason }}</p>
    <ul v-if="details.length">
      <li v-for="(detail, i) in details" :key="i">
        {{ detail }}
      </li>
    </ul>
    <p class="text-sm">
      Total blocks: {{ blockCount }}
    </p>
    <button @click="reset">
      Dismiss
    </button>
  </div>

  <div v-if="error" class="text-red">
    Safety check error: {{ error.message }}
  </div>
</template>
```

**Return values:**

| Ref | Type | Description |
|---|---|---|
| `checkText` | `(text: string, model?: string) => Promise<void>` | Run a safety check on the given text |
| `lastCheck` | `ShallowRef<ArmorSafetyResponse \| null>` | Full response from the last safety check |
| `isBlocked` | `ComputedRef<boolean>` | Whether the last checked text was blocked |
| `reason` | `ComputedRef<string \| null>` | Human-readable reason for the block |
| `details` | `ComputedRef<string[]>` | Detailed list of matched safety rules |
| `blockCount` | `Ref<number>` | Running count of blocked requests in this session |
| `reset` | `() => void` | Clear all safety state (lastCheck, isBlocked, etc.) |
| `pending` | `Ref<boolean>` | Whether a safety check is in progress |
| `error` | `Ref<Error \| null>` | Error from the last safety check attempt |

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
const { isHealthy, rateLimitRemaining } = useArmorStatus()

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
      <span class="font-medium">{{ isHealthy ? 'Operational' : 'Degraded' }}</span>
      <span class="ml-2">Rate limit remaining: {{ rateLimitRemaining }}</span>
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

## Advanced: Server Plugin Configuration

When your configuration requires non-serializable values (callbacks, `RegExp`, `StorageAdapter`), the module cannot pass them through `runtimeConfig`. Instead, create a server plugin:

```ts
// server/plugins/armor.ts
import { initArmor } from '#imports'
import { createArmor, createRedisAdapter } from 'ai-armor'
import Redis from 'ioredis'

export default defineNitroPlugin(() => {
  const redis = new Redis()

  const armor = createArmor({
    rateLimit: {
      strategy: 'sliding-window',
      rules: [{ key: 'user', limit: 100, window: '1m' }],
      store: createRedisAdapter(redis),
      onLimited: (ctx) => {
        console.warn(`Rate limited: ${ctx.userId}`)
      },
    },
    safety: {
      promptInjection: true,
      blockedPatterns: [/confidential/gi],
    },
  })

  initArmor(armor)
})
```

The `initArmor()` function replaces the default auto-initialized instance. Your server plugin runs before any route handler, so the custom instance is available everywhere via `useArmorInstance()`.

::: tip
When using a server plugin, you can set `aiArmor: {}` in `nuxt.config.ts` to skip the auto-initialization warning. The module will still register the composables and API routes.
:::

## Built-in API Routes

The module registers three server API routes:

| Route | Method | Description |
|-------|--------|-------------|
| `/api/_armor/usage` | GET | Returns cost data (today, month, budget, history) |
| `/api/_armor/status` | GET | Returns health status and rate limit info |
| `/api/_armor/safety` | POST | Checks text for safety violations |

All routes support optional authentication via `adminSecret`:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  aiArmor: {
    adminSecret: process.env.AI_ARMOR_ADMIN_SECRET,
    // ... other config
  },
})
```

When `adminSecret` is set, requests must include the `x-armor-admin-secret` header. Without it, endpoints are publicly accessible.

::: warning
In production, always set `adminSecret` to protect these endpoints from unauthorized access.
:::

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
