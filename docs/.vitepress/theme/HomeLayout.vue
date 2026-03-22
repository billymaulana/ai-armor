<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import HomeHero from './HomeHero.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #home-hero-before>
      <HomeHero />
    </template>
    <template #home-hero-after />
  </Layout>
</template>
