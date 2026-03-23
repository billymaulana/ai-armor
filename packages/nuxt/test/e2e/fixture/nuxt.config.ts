export default defineNuxtConfig({
  modules: ['../../../src/module'],

  aiArmor: {
    rateLimit: {
      strategy: 'sliding-window' as const,
      rules: [{ key: 'ip' as const, limit: 100, window: '1m' }],
    },
    budget: {
      daily: 100,
      monthly: 1000,
      onExceeded: 'block' as const,
    },
    safety: {
      promptInjection: true,
      piiDetection: true,
    },
    adminSecret: 'test-secret-123',
  },
})
