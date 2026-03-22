import type { ArmorInstance } from 'ai-armor'

let _armor: ArmorInstance | undefined

export function initArmor(instance: ArmorInstance): void {
  _armor = instance
}

export function useArmorInstance(): ArmorInstance {
  if (!_armor) {
    throw new Error('[ai-armor] Armor instance not initialized. Ensure the aiArmor Nitro plugin has loaded.')
  }
  return _armor
}
