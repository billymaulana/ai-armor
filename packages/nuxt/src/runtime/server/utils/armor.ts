import type { ArmorInstance } from 'ai-armor'

let _armor: ArmorInstance | undefined

export function initArmor(instance: ArmorInstance): void {
  if (_armor) {
    console.warn('[ai-armor] initArmor() called more than once — replacing existing instance. This may indicate duplicate plugin registration.')
  }
  _armor = instance
}

export function useArmorInstance(): ArmorInstance {
  if (!_armor) {
    throw new Error('[ai-armor] Armor instance not initialized. Ensure the aiArmor Nitro plugin has loaded.')
  }
  return _armor
}
