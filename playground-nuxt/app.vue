<script setup lang="ts">
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white border-b border-gray-200 px-6 py-4">
      <div class="max-w-6xl mx-auto flex items-center justify-between">
        <h1 class="text-xl font-bold text-gray-900">
          ai-armor Playground
        </h1>
        <nav class="flex gap-4">
          <NuxtLink to="/" class="text-sm text-gray-600 hover:text-gray-900" active-class="text-blue-600 font-medium">
            Chat Demo
          </NuxtLink>
          <NuxtLink to="/dashboard" class="text-sm text-gray-600 hover:text-gray-900" active-class="text-blue-600 font-medium">
            Dashboard
          </NuxtLink>
        </nav>
      </div>
    </header>
    <main class="max-w-6xl mx-auto p-6">
      <NuxtPage />
    </main>
  </div>
</template>

<style>
body {
  font-family: system-ui, -apple-system, sans-serif;
  margin: 0;
}
</style>
