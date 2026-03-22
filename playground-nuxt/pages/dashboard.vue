<script setup lang="ts">
const { todayCost, monthCost, budget, isNearLimit, costHistory } = useArmorCost()
const { activeProvider, isHealthy, fallbackActive, rateLimitRemaining } = useArmorStatus()

const dailyPercent = computed(() => {
  if (!budget.value.daily)
    return 0
  return Math.min((todayCost.value / budget.value.daily) * 100, 100)
})

const monthlyPercent = computed(() => {
  if (!budget.value.monthly)
    return 0
  return Math.min((monthCost.value / budget.value.monthly) * 100, 100)
})
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-2xl font-bold text-gray-800">
      AI Cost Dashboard
    </h2>

    <!-- Provider Status -->
    <div class="bg-white rounded-lg border border-gray-200 p-6">
      <h3 class="font-semibold text-gray-800 mb-4">
        System Status
      </h3>
      <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div class="text-center p-3 rounded-lg" :class="isHealthy ? 'bg-green-50' : 'bg-red-50'">
          <p class="text-xs text-gray-500 uppercase">
            Provider
          </p>
          <p class="font-semibold" :class="isHealthy ? 'text-green-700' : 'text-red-700'">
            {{ activeProvider || 'N/A' }}
          </p>
          <p class="text-xs" :class="isHealthy ? 'text-green-600' : 'text-red-600'">
            {{ isHealthy ? 'Operational' : 'Degraded' }}
          </p>
        </div>
        <div class="text-center p-3 rounded-lg bg-gray-50">
          <p class="text-xs text-gray-500 uppercase">
            Fallback
          </p>
          <p class="font-semibold" :class="fallbackActive ? 'text-yellow-700' : 'text-gray-700'">
            {{ fallbackActive ? 'Active' : 'Inactive' }}
          </p>
        </div>
        <div class="text-center p-3 rounded-lg bg-gray-50">
          <p class="text-xs text-gray-500 uppercase">
            Rate Limit
          </p>
          <p class="font-semibold text-gray-700">
            {{ rateLimitRemaining }} remaining
          </p>
        </div>
        <div class="text-center p-3 rounded-lg" :class="isNearLimit ? 'bg-yellow-50' : 'bg-gray-50'">
          <p class="text-xs text-gray-500 uppercase">
            Budget Alert
          </p>
          <p class="font-semibold" :class="isNearLimit ? 'text-yellow-700' : 'text-gray-700'">
            {{ isNearLimit ? 'Near Limit' : 'Normal' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Budget Gauges -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div class="bg-white rounded-lg border border-gray-200 p-6">
        <h3 class="font-semibold text-gray-800 mb-3">
          Daily Budget
        </h3>
        <div class="w-full bg-gray-200 rounded-full h-4 mb-2">
          <div
            class="h-4 rounded-full transition-all duration-500"
            :class="dailyPercent > 80 ? 'bg-red-500' : dailyPercent > 50 ? 'bg-yellow-500' : 'bg-blue-500'"
            :style="{ width: `${dailyPercent}%` }"
          />
        </div>
        <p class="text-sm text-gray-600">
          ${{ todayCost.toFixed(4) }} / ${{ budget.daily }}
        </p>
        <p class="text-xs text-gray-400 mt-1">
          {{ dailyPercent.toFixed(1) }}% used
        </p>
      </div>
      <div class="bg-white rounded-lg border border-gray-200 p-6">
        <h3 class="font-semibold text-gray-800 mb-3">
          Monthly Budget
        </h3>
        <div class="w-full bg-gray-200 rounded-full h-4 mb-2">
          <div
            class="h-4 rounded-full transition-all duration-500"
            :class="monthlyPercent > 80 ? 'bg-red-500' : monthlyPercent > 50 ? 'bg-yellow-500' : 'bg-blue-500'"
            :style="{ width: `${monthlyPercent}%` }"
          />
        </div>
        <p class="text-sm text-gray-600">
          ${{ monthCost.toFixed(4) }} / ${{ budget.monthly }}
        </p>
        <p class="text-xs text-gray-400 mt-1">
          {{ monthlyPercent.toFixed(1) }}% used
        </p>
      </div>
    </div>

    <!-- Cost History -->
    <div class="bg-white rounded-lg border border-gray-200 p-6">
      <h3 class="font-semibold text-gray-800 mb-4">
        Cost History
      </h3>
      <div v-if="costHistory.length === 0" class="text-center text-gray-400 py-8">
        No cost data yet. Send some chat messages first!
      </div>
      <div v-else class="divide-y divide-gray-100">
        <div v-for="entry in costHistory" :key="entry.date" class="flex justify-between py-3">
          <span class="text-sm text-gray-600">{{ entry.date }}</span>
          <span class="text-sm font-mono font-medium text-gray-800">${{ entry.cost.toFixed(6) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
