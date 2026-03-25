import { useRuntimeConfig } from '#imports'
import { createArmor } from 'ai-armor'
import { defineNitroPlugin } from 'nitropack/runtime'
import { initArmor } from '../utils/armor'

export default defineNitroPlugin(() => {
  try {
    const config = useRuntimeConfig().aiArmor ?? {}
    const armor = createArmor(config)
    initArmor(armor)
  }
  catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`[ai-armor] Failed to initialize: ${message}`)
  }
})
