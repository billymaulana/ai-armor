import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts', '**/*.d.ts', '**/types.ts'],
      thresholds: {
        lines: 99,
        functions: 99,
        branches: 98,
        statements: 99,
      },
    },
  },
})
