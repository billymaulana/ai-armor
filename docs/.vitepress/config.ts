import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'AI ARMOR',
  description: 'Production AI Toolkit for TypeScript -- rate limiting, cost tracking, caching, safety guardrails',
  base: '/ai-armor/',
  appearance: 'dark',
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/ai-armor/favicon.svg' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=JetBrains+Mono:wght@400;500;600&display=swap', rel: 'stylesheet' }],
    ['meta', { name: 'theme-color', content: '#00E5FF' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'AI ARMOR -- Production AI Toolkit for TypeScript' }],
    ['meta', { property: 'og:description', content: 'Rate limiting, cost tracking, caching, model routing, and safety guardrails for AI APIs. Works with OpenAI, Anthropic, Google, and 15+ providers.' }],
  ],
  themeConfig: {
    logo: '/logo-shield.svg',
    siteTitle: 'AI ARMOR',
    search: {
      provider: 'local',
    },
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/create-armor' },
      { text: 'Examples', link: '/examples/providers' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Why AI ARMOR?', link: '/guide/why' },
          { text: 'Rate Limiting', link: '/guide/rate-limiting' },
          { text: 'Cost Tracking', link: '/guide/cost-tracking' },
          { text: 'Caching', link: '/guide/caching' },
          { text: 'Model Routing', link: '/guide/model-routing' },
          { text: 'Safety', link: '/guide/safety' },
          { text: 'Logging', link: '/guide/logging' },
        ],
      },
      {
        text: 'Integrations',
        items: [
          { text: 'Vercel AI SDK', link: '/integrations/ai-sdk' },
          { text: 'Nuxt Module', link: '/integrations/nuxt' },
        ],
      },
      {
        text: 'API Reference',
        items: [
          { text: 'createArmor', link: '/api/create-armor' },
          { text: 'Types', link: '/api/types' },
        ],
      },
      {
        text: 'Examples',
        items: [
          { text: 'Provider Examples', link: '/examples/providers' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/billymaulana/ai-armor' },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright 2026 Billy Maulana',
    },
    editLink: {
      pattern: 'https://github.com/billymaulana/ai-armor/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
})
