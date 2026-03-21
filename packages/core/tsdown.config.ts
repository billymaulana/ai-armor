import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'ai-sdk': 'src/middleware/ai-sdk.ts',
    http: 'src/http/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
})
