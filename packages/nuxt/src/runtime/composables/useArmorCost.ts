import type { ArmorUsageResponse } from '../types'
import { computed, onMounted, onServerPrefetch, ref, shallowRef } from 'vue'

export function useArmorCost() {
  const data = shallowRef<ArmorUsageResponse | null>(null)
  const pending = ref(false)
  const error = ref<Error | null>(null)

  async function refresh(): Promise<void> {
    pending.value = true
    error.value = null
    try {
      data.value = await $fetch<ArmorUsageResponse>('/api/_armor/usage')
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

  const todayCost = computed(() => data.value?.todayCost ?? 0)
  const monthCost = computed(() => data.value?.monthCost ?? 0)
  const budget = computed(() => data.value?.budget ?? { daily: 0, monthly: 0 })
  const costHistory = computed(() => data.value?.costHistory ?? [])
  const isNearLimit = computed(() => {
    if (!data.value?.budget.daily)
      return false
    return data.value.todayCost >= data.value.budget.daily * 0.8
  })

  return {
    todayCost,
    monthCost,
    budget,
    costHistory,
    isNearLimit,
    refresh,
    pending,
    error,
  }
}
