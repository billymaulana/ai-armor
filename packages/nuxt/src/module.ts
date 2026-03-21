import { addImports, createResolver, defineNuxtModule } from '@nuxt/kit'

export interface ModuleOptions {
  rateLimit?: Record<string, unknown>
  budget?: Record<string, unknown>
  fallback?: Record<string, unknown>
  cache?: Record<string, unknown>
  routing?: Record<string, unknown>
  safety?: Record<string, unknown>
  logging?: Record<string, unknown>
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@ai-armor/nuxt',
    configKey: 'aiArmor',
    compatibility: {
      nuxt: '>=3.0.0',
    },
  },
  defaults: {},
  setup(_options, _nuxt) {
    const { resolve } = createResolver(import.meta.url)

    // Auto-import composables
    addImports([
      { name: 'useArmorCost', from: resolve('./runtime/composables/useArmorCost') },
      { name: 'useArmorStatus', from: resolve('./runtime/composables/useArmorStatus') },
      { name: 'useArmorSafety', from: resolve('./runtime/composables/useArmorSafety') },
    ])

    // TODO: Add server middleware for /api/ai/** routes
    // TODO: Add server API routes for /api/_armor/*
  },
})
