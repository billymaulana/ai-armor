import type { ArmorInstance } from 'ai-armor'

let _armor: ArmorInstance | undefined

export function initArmor(instance: ArmorInstance): void {
  // Silently replace if called twice (e.g. HMR during development).
  // The latest instance always wins.
  _armor = instance
}

export function useArmorInstance(): ArmorInstance {
  if (!_armor) {
    throw new Error('[ai-armor] Armor instance not initialized. Ensure the aiArmor Nitro plugin has loaded.')
  }
  return _armor
}

/** Reset singleton — used only in tests. */
export function _resetArmor(): void {
  _armor = undefined
}
