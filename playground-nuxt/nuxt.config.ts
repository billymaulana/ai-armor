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
      daily: 50,
      monthly: 500,
      perUser: 10,
      onExceeded: 'downgrade-model',
      downgradeMap: {
        'gpt-4o': 'gpt-4o-mini',
        'claude-sonnet-4-20250514': 'claude-haiku-4-5-20251001',
      },
    },
    cache: {
      enabled: true,
      strategy: 'exact',
      ttl: 300,
      driver: 'memory',
      maxSize: 500,
    },
    routing: {
      aliases: {
        fast: 'gpt-4o-mini',
        smart: 'gpt-4o',
        best: 'claude-sonnet-4-20250514',
      },
    },
    safety: {
      promptInjection: true,
      piiDetection: true,
      maxTokensPerRequest: 4096,
    },
    logging: {
      enabled: true,
      include: ['model', 'tokens', 'cost', 'latency', 'cached', 'userId'],
    },
  },

  devtools: { enabled: true },
  compatibilityDate: '2025-03-23',
})
