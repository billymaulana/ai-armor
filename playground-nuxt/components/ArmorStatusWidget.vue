<script setup lang="ts">
const { activeProvider, isHealthy, fallbackActive, rateLimitRemaining } = useArmorStatus()
</script>

<template>
  <div class="bg-white rounded-lg border border-gray-200 p-4">
    <h3 class="font-semibold text-gray-800 mb-3">
      System Status
    </h3>
    <div class="space-y-2 text-sm">
      <div class="flex justify-between">
        <span class="text-gray-500">Provider</span>
        <span :class="isHealthy ? 'text-green-600' : 'text-red-600'">
          {{ activeProvider || 'N/A' }}
        </span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-500">Health</span>
        <span :class="isHealthy ? 'text-green-600' : 'text-red-600'">
          {{ isHealthy ? 'Healthy' : 'Degraded' }}
        </span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-500">Fallback</span>
        <span :class="fallbackActive ? 'text-yellow-600' : 'text-gray-600'">
          {{ fallbackActive ? 'Active' : 'Off' }}
        </span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-500">Rate Limit</span>
        <span class="text-gray-800">{{ rateLimitRemaining }} left</span>
      </div>
    </div>
  </div>
</template>
