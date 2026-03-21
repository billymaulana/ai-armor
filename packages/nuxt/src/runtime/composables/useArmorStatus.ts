import { ref } from 'vue'

export function useArmorStatus() {
  const activeProvider = ref('')
  const isHealthy = ref(true)
  const fallbackActive = ref(false)
  const rateLimitRemaining = ref(0)

  // TODO: fetch from /api/_armor/status

  return {
    activeProvider,
    isHealthy,
    fallbackActive,
    rateLimitRemaining,
  }
}
