import type { ArmorStatusResponse } from '../types'
import { computed, onMounted, onServerPrefetch, ref, shallowRef } from 'vue'

export function useArmorStatus() {
  const data = shallowRef<ArmorStatusResponse | null>(null)
  const pending = ref(false)
  const error = ref<Error | null>(null)

  async function refresh(): Promise<void> {
    pending.value = true
    error.value = null
    try {
      data.value = await $fetch<ArmorStatusResponse>('/api/_armor/status')
    }
    catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
    }
    finally {
      pending.value = false
    }
  }

  // SSR-safe: fetch during server render and client mount
  onServerPrefetch(refresh)
  onMounted(refresh)

  const isHealthy = computed(() => data.value?.healthy ?? true)
  const rateLimitRemaining = computed(() => data.value?.rateLimitRemaining ?? 0)
  const rateLimitResetAt = computed(() => data.value?.rateLimitResetAt ?? null)

  return {
    isHealthy,
    rateLimitRemaining,
    rateLimitResetAt,
    refresh,
    pending,
    error,
  }
}
