import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'ai-armor',
  description: 'Production AI Toolkit for TypeScript',
  base: '/ai-armor/',
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
  ],
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/create-armor' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Why ai-armor?', link: '/guide/why' },
          { text: 'Rate Limiting', link: '/guide/rate-limiting' },
          { text: 'Cost Tracking', link: '/guide/cost-tracking' },
          { text: 'Fallback', link: '/guide/fallback' },
          { text: 'Caching', link: '/guide/caching' },
          { text: 'Model Routing', link: '/guide/model-routing' },
          { text: 'Safety', link: '/guide/safety' },
          { text: 'Logging', link: '/guide/logging' },
        ],
      },
      {
        text: 'Integrations',
        items: [
          { text: 'AI SDK', link: '/integrations/ai-sdk' },
          { text: 'Nuxt', link: '/integrations/nuxt' },
        ],
      },
      {
        text: 'API Reference',
        items: [
          { text: 'createArmor', link: '/api/create-armor' },
          { text: 'Composables', link: '/api/composables' },
          { text: 'Types', link: '/api/types' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/billymaulana/ai-armor' },
    ],
  },
})
