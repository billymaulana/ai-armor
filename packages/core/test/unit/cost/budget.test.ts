import { describe, expect, it } from 'vitest'
import { createCostTracker } from '../../../src/cost/tracker'

describe('createCostTracker', () => {
  it('should track usage and accumulate cost', async () => {
    const tracker = createCostTracker({
      daily: 50,
      monthly: 500,
      onExceeded: 'block',
    })

    // gpt-4o: input $2.50/1M, output $10.00/1M
    await tracker.trackUsage('gpt-4o', 1000, 500)

    const daily = await tracker.getDailyCost()
    expect(daily).toBeGreaterThan(0)
  })

  it('should check budget and allow when within limits', async () => {
    const tracker = createCostTracker({
      daily: 50,
      monthly: 500,
      onExceeded: 'block',
    })

    const result = await tracker.checkBudget('gpt-4o', { userId: 'user-1' })
    expect(result.allowed).toBe(true)
    expect(result.action).toBe('pass')
  })

  it('should block when daily limit exceeded', async () => {
    const tracker = createCostTracker({
      daily: 0.001,
      monthly: 500,
      onExceeded: 'block',
    })

    // Track enough to exceed daily limit
    await tracker.trackUsage('gpt-4o', 1000, 500)

    const result = await tracker.checkBudget('gpt-4o', {})
    expect(result.allowed).toBe(false)
    expect(result.action).toBe('block')
  })

  it('should warn when limit exceeded with warn action', async () => {
    const tracker = createCostTracker({
      daily: 0.001,
      monthly: 500,
      onExceeded: 'warn',
    })

    await tracker.trackUsage('gpt-4o', 1000, 500)

    const result = await tracker.checkBudget('gpt-4o', {})
    expect(result.allowed).toBe(true)
    expect(result.action).toBe('warn')
  })

  it('should suggest downgrade model when budget exceeded', async () => {
    const tracker = createCostTracker({
      daily: 0.001,
      monthly: 500,
      onExceeded: 'downgrade-model',
      downgradeMap: { 'gpt-4o': 'gpt-4o-mini' },
    })

    await tracker.trackUsage('gpt-4o', 1000, 500)

    const result = await tracker.checkBudget('gpt-4o', {})
    expect(result.allowed).toBe(true)
    expect(result.action).toBe('downgrade-model')
    expect(result.suggestedModel).toBe('gpt-4o-mini')
  })

  it('should enforce per-user limits', async () => {
    const tracker = createCostTracker({
      perUser: 0.001,
      onExceeded: 'block',
    })

    await tracker.trackUsage('gpt-4o', 1000, 500, 'user-1')

    const result = await tracker.checkBudget('gpt-4o', { userId: 'user-1' })
    expect(result.allowed).toBe(false)

    // Different user should still be allowed
    const result2 = await tracker.checkBudget('gpt-4o', { userId: 'user-2' })
    expect(result2.allowed).toBe(true)
  })

  it('should estimate cost without tracking', () => {
    const tracker = createCostTracker({
      daily: 50,
      onExceeded: 'block',
    })

    const cost = tracker.estimateCost('gpt-4o', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(12.50, 1)
  })

  it('should report model pricing availability', () => {
    const tracker = createCostTracker({
      daily: 50,
      onExceeded: 'block',
    })

    expect(tracker.hasModelPricing('gpt-4o')).toBe(true)
    expect(tracker.hasModelPricing('nonexistent')).toBe(false)
  })

  it('should reset tracked costs', async () => {
    const tracker = createCostTracker({
      daily: 50,
      onExceeded: 'block',
    })

    await tracker.trackUsage('gpt-4o', 1000, 500)
    expect(await tracker.getDailyCost()).toBeGreaterThan(0)

    tracker.reset()
    expect(await tracker.getDailyCost()).toBe(0)
  })
})
