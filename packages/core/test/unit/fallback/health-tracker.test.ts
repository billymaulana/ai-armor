import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHealthTracker } from '../../../src/fallback/health-tracker'

describe('createHealthTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should report unknown provider as healthy', () => {
    const tracker = createHealthTracker()
    expect(tracker.isHealthy('openai')).toBe(true)
  })

  it('should remain healthy below failure threshold', () => {
    const tracker = createHealthTracker({ failureThreshold: 3 })
    tracker.recordFailure('openai')
    tracker.recordFailure('openai')
    expect(tracker.isHealthy('openai')).toBe(true)
  })

  it('should open circuit after threshold failures', () => {
    const tracker = createHealthTracker({ failureThreshold: 3 })
    tracker.recordFailure('openai')
    tracker.recordFailure('openai')
    tracker.recordFailure('openai')
    const health = tracker.getHealth('openai')
    expect(health.circuitOpen).toBe(true)
    expect(health.failures).toBe(3)
  })

  it('should report unhealthy when circuit open', () => {
    const tracker = createHealthTracker({ failureThreshold: 2 })
    tracker.recordFailure('openai')
    tracker.recordFailure('openai')
    expect(tracker.isHealthy('openai')).toBe(false)
  })

  it('should allow half-open check after recovery window', () => {
    const tracker = createHealthTracker({ failureThreshold: 2, recoveryWindow: 5000 })
    tracker.recordFailure('openai')
    tracker.recordFailure('openai')
    expect(tracker.isHealthy('openai')).toBe(false)

    vi.advanceTimersByTime(5000)
    expect(tracker.isHealthy('openai')).toBe(true)
  })

  it('should close circuit on success after half-open', () => {
    const tracker = createHealthTracker({ failureThreshold: 2, recoveryWindow: 5000 })
    tracker.recordFailure('openai')
    tracker.recordFailure('openai')

    vi.advanceTimersByTime(5000)
    expect(tracker.isHealthy('openai')).toBe(true)

    tracker.recordSuccess('openai')
    const health = tracker.getHealth('openai')
    expect(health.circuitOpen).toBe(false)
    expect(health.failures).toBe(0)
  })

  it('should re-open circuit on failure during half-open', () => {
    const tracker = createHealthTracker({ failureThreshold: 2, recoveryWindow: 5000 })
    tracker.recordFailure('openai')
    tracker.recordFailure('openai')

    vi.advanceTimersByTime(5000)
    expect(tracker.isHealthy('openai')).toBe(true)

    tracker.recordFailure('openai')
    expect(tracker.getHealth('openai').failures).toBe(3)
    expect(tracker.getHealth('openai').circuitOpen).toBe(true)
  })

  it('should only allow one probe during half-open (thundering herd prevention)', () => {
    const tracker = createHealthTracker({ failureThreshold: 2, recoveryWindow: 5000 })
    tracker.recordFailure('openai')
    tracker.recordFailure('openai')

    vi.advanceTimersByTime(5000)
    expect(tracker.isHealthy('openai')).toBe(true) // first probe: allowed
    expect(tracker.isHealthy('openai')).toBe(false) // second probe: blocked
  })

  it('should allow new probe after failed half-open probe re-opens circuit', () => {
    const tracker = createHealthTracker({ failureThreshold: 2, recoveryWindow: 5000 })
    tracker.recordFailure('openai')
    tracker.recordFailure('openai')

    vi.advanceTimersByTime(5000)
    expect(tracker.isHealthy('openai')).toBe(true) // probe allowed

    tracker.recordFailure('openai') // probe failed, circuit re-opens

    vi.advanceTimersByTime(5000)
    expect(tracker.isHealthy('openai')).toBe(true) // new probe allowed
    expect(tracker.isHealthy('openai')).toBe(false) // second blocked again
  })

  it('should reset all providers', () => {
    const tracker = createHealthTracker({ failureThreshold: 1 })
    tracker.recordFailure('openai')
    tracker.recordFailure('anthropic')
    expect(tracker.isHealthy('openai')).toBe(false)
    expect(tracker.isHealthy('anthropic')).toBe(false)

    tracker.reset()
    expect(tracker.isHealthy('openai')).toBe(true)
    expect(tracker.isHealthy('anthropic')).toBe(true)
  })

  it('should return default health for unknown provider', () => {
    const tracker = createHealthTracker()
    const health = tracker.getHealth('unknown')
    expect(health).toEqual({
      failures: 0,
      lastFailure: 0,
      circuitOpen: false,
      circuitOpenedAt: 0,
    })
  })

  it('should use custom failureThreshold', () => {
    const tracker = createHealthTracker({ failureThreshold: 5 })
    for (let i = 0; i < 4; i++)
      tracker.recordFailure('openai')
    expect(tracker.isHealthy('openai')).toBe(true)

    tracker.recordFailure('openai')
    expect(tracker.isHealthy('openai')).toBe(false)
  })

  it('should use custom recoveryWindow', () => {
    const tracker = createHealthTracker({ failureThreshold: 1, recoveryWindow: 60_000 })
    tracker.recordFailure('openai')
    expect(tracker.isHealthy('openai')).toBe(false)

    vi.advanceTimersByTime(59_999)
    expect(tracker.isHealthy('openai')).toBe(false)

    vi.advanceTimersByTime(1)
    expect(tracker.isHealthy('openai')).toBe(true)
  })

  it('should reset failure count on success', () => {
    const tracker = createHealthTracker({ failureThreshold: 3 })
    tracker.recordFailure('openai')
    tracker.recordFailure('openai')
    expect(tracker.getHealth('openai').failures).toBe(2)

    tracker.recordSuccess('openai')
    expect(tracker.getHealth('openai').failures).toBe(0)
    expect(tracker.getHealth('openai').lastFailure).toBe(0)
  })
})
