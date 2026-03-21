import { ref } from 'vue'

export function useArmorCost() {
  const todayCost = ref(0)
  const monthCost = ref(0)
  const budget = ref({ daily: 0, monthly: 0 })
  const isNearLimit = ref(false)
  const costHistory = ref<Array<{ date: string, cost: number }>>([])

  // TODO: fetch from /api/_armor/usage

  return {
    todayCost,
    monthCost,
    budget,
    isNearLimit,
    costHistory,
  }
}
