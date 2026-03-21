import { ref } from 'vue'

export function useArmorSafety() {
  const lastBlocked = ref<string | null>(null)
  const blockReason = ref<string | null>(null)

  // TODO: implement safety status tracking

  return {
    lastBlocked,
    blockReason,
  }
}
