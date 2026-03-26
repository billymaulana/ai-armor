import antfu from '@antfu/eslint-config'

export default antfu({
  typescript: true,
  vue: true,
  ignores: ['**/dist/**', '**/.nuxt/**', '**/coverage/**', '**/examples/**'],
  rules: {
    'no-console': 'error',
  },
})
