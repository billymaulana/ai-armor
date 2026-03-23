import type { ArmorSafetyResponse } from '../types'
import { computed, ref, shallowRef } from 'vue'

export function useArmorSafety() {
  const lastCheck = shallowRef<ArmorSafetyResponse | null>(null)
  const pending = ref(false)
  const error = ref<Error | null>(null)
  const blockCount = ref(0)

  async function checkText(text: string, model?: string): Promise<ArmorSafetyResponse> {
    pending.value = true
    error.value = null
    try {
      const result = await $fetch<ArmorSafetyResponse>('/api/_armor/safety', {
        method: 'POST',
        body: { text, model },
      })
      lastCheck.value = result
      if (result.blocked)
        blockCount.value++
      return result
    }
    catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
      throw error.value
    }
    finally {
      pending.value = false
    }
  }

  function reset(): void {
    lastCheck.value = null
    blockCount.value = 0
    error.value = null
  }

  return {
    checkText,
    lastCheck,
    isBlocked: computed(() => lastCheck.value?.blocked ?? false),
    reason: computed(() => lastCheck.value?.reason ?? null),
    details: computed(() => lastCheck.value?.details ?? []),
    blockCount,
    reset,
    pending,
    error,
  }
}
