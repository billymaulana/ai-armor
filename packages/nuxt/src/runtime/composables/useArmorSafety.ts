import { ref } from 'vue'

// Per-instance state using a factory pattern.
// Each call to useArmorSafety() returns shared refs within the same component tree,
// but we use separate refs per-composable-call to avoid SSR cross-request pollution
// that occurs with module-level state.
// For shared state across components, wrap with Nuxt's useState() in your app code.
export function useArmorSafety() {
  const lastBlocked = ref<string | null>(null)
  const blockReason = ref<string | null>(null)
  const blockCount = ref(0)

  function recordBlock(reason: string): void {
    lastBlocked.value = new Date().toISOString()
    blockReason.value = reason
    blockCount.value++
  }

  function reset(): void {
    lastBlocked.value = null
    blockReason.value = null
    blockCount.value = 0
  }

  return {
    lastBlocked,
    blockReason,
    blockCount,
    recordBlock,
    reset,
  }
}
