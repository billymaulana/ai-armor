import type {
  BudgetConfig,
  CacheConfig,
  FallbackConfig,
  LoggingConfig,
  RateLimitConfig,
  RoutingConfig,
  SafetyConfig,
} from 'ai-armor'
import { addImports, addServerHandler, addServerPlugin, createResolver, defineNuxtModule, useLogger } from '@nuxt/kit'

const logger = useLogger('ai-armor')

export interface ModuleOptions {
  rateLimit?: RateLimitConfig
  budget?: BudgetConfig
  fallback?: FallbackConfig
  cache?: CacheConfig
  routing?: RoutingConfig
  safety?: SafetyConfig
  logging?: LoggingConfig
  adminSecret?: string
}

export function findNonSerializableKeys(obj: unknown, prefix = ''): string[] {
  const keys: string[] = []
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${key}` : key
      if (typeof value === 'function') {
        keys.push(`${path} (function)`)
      }
      else if (value instanceof RegExp) {
        keys.push(`${path} (RegExp)`)
      }
      else if (value && typeof value === 'object') {
        keys.push(...findNonSerializableKeys(value, path))
      }
    }
  }
  return keys
}

export function toSerializable(obj: unknown): Record<string, unknown> {
  const stripped = findNonSerializableKeys(obj)
  if (stripped.length > 0) {
    logger.warn(
      `Non-serializable config keys stripped from runtimeConfig: ${stripped.join(', ')}. `
      + 'Use a server plugin with initArmor() for callbacks and StorageAdapter.',
    )
  }
  // JSON round-trip strips functions, RegExps, undefined -- safe for runtimeConfig
  return JSON.parse(JSON.stringify(obj ?? {}))
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: '@ai-armor/nuxt',
    configKey: 'aiArmor',
    compatibility: {
      nuxt: '>=3.0.0 || >=4.0.0',
    },
  },
  defaults: {},
  setup(options, nuxt) {
    const { resolve } = createResolver(import.meta.url)

    // Pass only serializable config to runtime (strips functions, RegExp, StorageAdapter)
    // For advanced config with callbacks/adapters, use a server plugin to call initArmor() directly.
    nuxt.options.runtimeConfig.aiArmor = {
      ...(nuxt.options.runtimeConfig.aiArmor as Record<string, unknown> ?? {}),
      ...toSerializable(options),
    }

    // Auto-import composables
    addImports([
      { name: 'useArmorCost', from: resolve('./runtime/composables/useArmorCost') },
      { name: 'useArmorStatus', from: resolve('./runtime/composables/useArmorStatus') },
      { name: 'useArmorSafety', from: resolve('./runtime/composables/useArmorSafety') },
    ])

    // Server plugin to initialize armor instance
    addServerPlugin(resolve('./runtime/server/plugins/armor'))

    // API routes (only when explicitly enabled or in dev mode)
    addServerHandler({
      route: '/api/_armor/usage',
      handler: resolve('./runtime/server/api/_armor/usage.get'),
    })
    addServerHandler({
      route: '/api/_armor/status',
      handler: resolve('./runtime/server/api/_armor/status.get'),
    })
    addServerHandler({
      route: '/api/_armor/safety',
      method: 'post',
      handler: resolve('./runtime/server/api/_armor/safety.post'),
    })

    // Rate limit middleware (only when configured)
    if (options.rateLimit) {
      addServerHandler({
        middleware: true,
        handler: resolve('./runtime/server/middleware/armor-rate-limit'),
      })
    }
  },
})
