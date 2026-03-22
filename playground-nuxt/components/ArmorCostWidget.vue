<script setup lang="ts">
const { todayCost, monthCost, budget, isNearLimit } = useArmorCost()
</script>

<template>
  <div class="bg-white rounded-lg border border-gray-200 p-4">
    <h3 class="font-semibold text-gray-800 mb-3">
      Cost Tracking
    </h3>
    <div class="space-y-3">
      <div>
        <div class="flex justify-between text-sm">
          <span class="text-gray-500">Today</span>
          <span class="font-mono">${{ todayCost.toFixed(4) }}</span>
        </div>
        <div v-if="budget.daily" class="text-xs text-gray-400">
          Limit: ${{ budget.daily }}
        </div>
      </div>
      <div>
        <div class="flex justify-between text-sm">
          <span class="text-gray-500">This Month</span>
          <span class="font-mono">${{ monthCost.toFixed(4) }}</span>
        </div>
        <div v-if="budget.monthly" class="text-xs text-gray-400">
          Limit: ${{ budget.monthly }}
        </div>
      </div>
      <div v-if="isNearLimit" class="text-xs text-yellow-600 font-medium bg-yellow-50 rounded px-2 py-1">
        Approaching budget limit
      </div>
    </div>
  </div>
</template>
