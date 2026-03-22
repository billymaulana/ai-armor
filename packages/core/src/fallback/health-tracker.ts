export interface ProviderHealth {
  failures: number
  lastFailure: number
  circuitOpen: boolean
  circuitOpenedAt: number
}

export interface HealthTrackerOptions {
  failureThreshold?: number
  recoveryWindow?: number
}

export function createHealthTracker(options?: HealthTrackerOptions) {
  const { failureThreshold = 3, recoveryWindow = 30_000 } = options ?? {}
  const providers = new Map<string, ProviderHealth>()
  // Track which providers have an in-flight half-open probe to prevent thundering herd
  const halfOpenProbes = new Set<string>()

  function getOrCreate(provider: string): ProviderHealth {
    let health = providers.get(provider)
    if (!health) {
      health = { failures: 0, lastFailure: 0, circuitOpen: false, circuitOpenedAt: 0 }
      providers.set(provider, health)
    }
    return health
  }

  return {
    recordSuccess(provider: string): void {
      const health = getOrCreate(provider)
      health.failures = 0
      health.circuitOpen = false
      health.circuitOpenedAt = 0
      health.lastFailure = 0
      halfOpenProbes.delete(provider)
    },

    recordFailure(provider: string): void {
      const health = getOrCreate(provider)
      health.failures++
      health.lastFailure = Date.now()
      if (health.failures >= failureThreshold) {
        health.circuitOpen = true
        health.circuitOpenedAt = Date.now()
        halfOpenProbes.delete(provider)
      }
    },

    isHealthy(provider: string): boolean {
      const health = providers.get(provider)
      if (!health)
        return true
      if (!health.circuitOpen)
        return true
      if (Date.now() - health.circuitOpenedAt >= recoveryWindow) {
        // Half-open: only allow one probe request to prevent thundering herd
        if (halfOpenProbes.has(provider))
          return false
        halfOpenProbes.add(provider)
        return true
      }
      return false
    },

    getHealth(provider: string): ProviderHealth {
      return providers.get(provider)
        ?? { failures: 0, lastFailure: 0, circuitOpen: false, circuitOpenedAt: 0 }
    },

    reset(): void {
      providers.clear()
      halfOpenProbes.clear()
    },
  }
}
