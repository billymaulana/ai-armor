import { useLogger } from '@nuxt/kit'

const logger = useLogger('ai-armor')

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
