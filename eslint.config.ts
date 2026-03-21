import antfu from '@antfu/eslint-config'

export default antfu({
  typescript: true,
  vue: true,
  ignores: ['**/dist/**', '**/.nuxt/**', '**/coverage/**'],
  rules: {
    'no-console': 'error',
  },
})
