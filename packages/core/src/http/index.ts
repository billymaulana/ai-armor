import type { ArmorInstance } from '../types'

export function createArmorHandler(_armor: ArmorInstance) {
  // TODO: implement HTTP middleware handler
  return (_req: unknown, _res: unknown, next: () => void) => {
    next()
  }
}
