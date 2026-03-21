# Getting Started

## Installation

```bash
# npm
npm install ai-armor

# pnpm
pnpm add ai-armor

# yarn
yarn add ai-armor
```

## Basic Usage

```ts
import { createArmor } from 'ai-armor'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 20, window: '1m' }],
  },
  budget: {
    daily: 50,
    monthly: 500,
    onExceeded: 'warn',
  },
  routing: {
    aliases: { fast: 'gpt-4o-mini', smart: 'claude-sonnet-4-6' },
  },
})
```

## Next Steps

- [Why ai-armor?](/guide/why) -- Understanding the problem
- [Rate Limiting](/guide/rate-limiting) -- Protect your endpoints
- [Cost Tracking](/guide/cost-tracking) -- Track and control spending
- [AI SDK Integration](/integrations/ai-sdk) -- Use with Vercel AI SDK
