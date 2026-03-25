<script setup lang="ts">
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-slate-900 border-b border-slate-700 px-6 py-4">
      <div class="max-w-6xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
          <img src="/logo-dark.svg" alt="AI-ARMOR" class="h-8">
          <h1 class="text-xl font-bold text-cyan-400">
            Playground
          </h1>
        </div>
        <nav class="flex gap-4">
          <NuxtLink to="/" class="text-sm text-slate-400 hover:text-white" active-class="text-cyan-400 font-medium">
            Chat Demo
          </NuxtLink>
          <NuxtLink to="/dashboard" class="text-sm text-slate-400 hover:text-white" active-class="text-cyan-400 font-medium">
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
