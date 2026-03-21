import { createArmor } from 'ai-armor'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 20, window: '1m' }],
  },
  budget: {
    daily: 50,
    monthly: 500,
    onExceeded: 'downgrade-model',
    downgradeMap: { 'gpt-4o': 'gpt-4o-mini' },
  },
  routing: {
    aliases: {
      fast: 'gpt-4o-mini',
      smart: 'claude-sonnet-4-6',
    },
  },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency'],
  },
})

// Resolve model aliases
const resolved = armor.resolveModel('fast')
// eslint-disable-next-line no-console
console.log(`Resolved 'fast' -> '${resolved}'`)
// eslint-disable-next-line no-console
console.log('Armor instance created:', armor.config)
