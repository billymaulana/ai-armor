import type { ArmorRequest, FallbackConfig, FallbackResult } from '../types'
import { createHealthTracker } from './health-tracker'

export function createFallbackChain(config: FallbackConfig) {
  const healthTracker = createHealthTracker(
    config.healthCheck !== false
      ? { failureThreshold: 3, recoveryWindow: 30_000 }
      : undefined,
  )
  const timeout = config.timeout ?? 30_000
  const retries = config.retries ?? 0
  const backoff = config.backoff ?? 'exponential'

  return {
    async execute<T>(
      request: ArmorRequest,
      handler: (model: string) => Promise<T>,
    ): Promise<FallbackResult<T>> {
      const chain = config.chains[request.model] ?? [request.model]

      let candidates = chain.filter(m => healthTracker.isHealthy(m))
      if (candidates.length === 0)
        candidates = [chain[0]!]

      const errors: Error[] = []
      let attempts = 0

      for (const model of candidates) {
        for (let attempt = 0; attempt <= retries; attempt++) {
          attempts++

          if (attempt > 0) {
            const delay = calculateBackoff(backoff, attempt)
            await sleep(delay)
          }

          try {
            const result = await executeWithTimeout(handler, model, timeout)
            healthTracker.recordSuccess(model)
            return {
              result,
              model,
              attempts,
              fallbackUsed: model !== chain[0],
            }
          }
          catch (err) {
            errors.push(err instanceof Error ? err : new Error(String(err)))
            healthTracker.recordFailure(model)
          }
        }
      }

      throw new AggregateError(errors, `All providers failed after ${attempts} attempts`)
    },

    getHealthTracker() {
      return healthTracker
    },
  }
}

function calculateBackoff(strategy: 'exponential' | 'linear', attempt: number): number {
  const base = 1000
  const cap = 10_000
  if (strategy === 'exponential') {
    return Math.min(base * (2 ** attempt), cap)
  }
  return Math.min(base * (attempt + 1), cap)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function executeWithTimeout<T>(
  handler: (model: string) => Promise<T>,
  model: string,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    handler(model)
      .then((result) => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}
