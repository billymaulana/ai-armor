import { vi } from 'vitest'

interface MockProviderOptions {
  latency?: number
  failRate?: number
  tokens?: { input: number, output: number }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function createMockProvider(options?: MockProviderOptions) {
  return {
    chat: vi.fn().mockImplementation(async () => {
      if (Math.random() < (options?.failRate ?? 0)) {
        throw new Error('Provider error')
      }
      await sleep(options?.latency ?? 10)
      return {
        content: 'Mock response',
        usage: options?.tokens ?? { input: 100, output: 50 },
      }
    }),
  }
}
