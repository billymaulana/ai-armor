import { describe, expect, it, vi } from 'vitest'
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

    await tracker.reset()
    expect(await tracker.getDailyCost()).toBe(0)
  })

  it('should block when monthly limit exceeded', async () => {
    const tracker = createCostTracker({
      daily: 999,
      monthly: 0.001,
      onExceeded: 'block',
    })

    await tracker.trackUsage('gpt-4o', 1000, 500)

    const result = await tracker.checkBudget('gpt-4o', {})
    expect(result.allowed).toBe(false)
    expect(result.action).toBe('block')
  })

  it('should warn when monthly limit exceeded with warn action', async () => {
    const tracker = createCostTracker({
      daily: 999,
      monthly: 0.001,
      onExceeded: 'warn',
    })

    await tracker.trackUsage('gpt-4o', 1000, 500)

    const result = await tracker.checkBudget('gpt-4o', {})
    expect(result.allowed).toBe(true)
    expect(result.action).toBe('warn')
  })

  it('should downgrade model when monthly limit exceeded', async () => {
    const tracker = createCostTracker({
      daily: 999,
      monthly: 0.001,
      onExceeded: 'downgrade-model',
      downgradeMap: { 'gpt-4o': 'gpt-4o-mini' },
    })

    await tracker.trackUsage('gpt-4o', 1000, 500)

    const result = await tracker.checkBudget('gpt-4o', {})
    expect(result.allowed).toBe(true)
    expect(result.action).toBe('downgrade-model')
    expect(result.suggestedModel).toBe('gpt-4o-mini')
  })

  it('should downgrade model when per-user limit exceeded', async () => {
    const tracker = createCostTracker({
      perUser: 0.001,
      onExceeded: 'downgrade-model',
      downgradeMap: { 'gpt-4o': 'gpt-4o-mini' },
    })

    await tracker.trackUsage('gpt-4o', 1000, 500, 'user-1')

    const result = await tracker.checkBudget('gpt-4o', { userId: 'user-1' })
    expect(result.allowed).toBe(true)
    expect(result.action).toBe('downgrade-model')
    expect(result.suggestedModel).toBe('gpt-4o-mini')
    expect(result.perUserDaily).toBeDefined()
  })

  it('should throw when redis store is passed as string', () => {
    expect(() => createCostTracker({
      daily: 50,
      onExceeded: 'block',
      store: 'redis',
    })).toThrow('[ai-armor] store: "redis" requires passing a StorageAdapter instance')
  })

  it('should use external StorageAdapter for tracking', async () => {
    const storage = new Map<string, unknown>()
    const adapter = {
      getItem: async (key: string) => storage.get(key),
      setItem: async (key: string, value: unknown) => { storage.set(key, value) },
      removeItem: async (key: string) => { storage.delete(key) },
    }

    const tracker = createCostTracker({
      daily: 50,
      onExceeded: 'block',
      store: adapter,
    })

    await tracker.trackUsage('gpt-4o', 1000, 500)

    const daily = await tracker.getDailyCost()
    expect(daily).toBeGreaterThan(0)
    expect(storage.has('cost-entries')).toBe(true)
  })

  it('should filter getMonthlyCost by userId', async () => {
    const tracker = createCostTracker({
      daily: 999,
      monthly: 999,
      onExceeded: 'block',
    })

    await tracker.trackUsage('gpt-4o', 1000, 500, 'user-1')
    await tracker.trackUsage('gpt-4o', 2000, 1000, 'user-2')

    const user1Monthly = await tracker.getMonthlyCost('user-1')
    const totalMonthly = await tracker.getMonthlyCost()

    expect(user1Monthly).toBeGreaterThan(0)
    expect(totalMonthly).toBeGreaterThan(user1Monthly)
  })

  it('should call onUnknownModel when tracking unknown model with tokens', async () => {
    const onUnknownModel = vi.fn()
    const tracker = createCostTracker({
      daily: 50,
      onExceeded: 'block',
      onUnknownModel,
    })

    await tracker.trackUsage('nonexistent-model', 1000, 500)

    expect(onUnknownModel).toHaveBeenCalledOnce()
    expect(onUnknownModel).toHaveBeenCalledWith('nonexistent-model')
  })

  it('should not call onUnknownModel when tokens are zero', async () => {
    const onUnknownModel = vi.fn()
    const tracker = createCostTracker({
      daily: 50,
      onExceeded: 'block',
      onUnknownModel,
    })

    await tracker.trackUsage('nonexistent-model', 0, 0)

    expect(onUnknownModel).not.toHaveBeenCalled()
  })

  it('should block when downgrade-model has no mapping for the model', async () => {
    const tracker = createCostTracker({
      daily: 0.001,
      onExceeded: 'downgrade-model',
      downgradeMap: { 'gpt-4o': 'gpt-4o-mini' },
    })

    // Use gpt-4o to accumulate cost (has pricing), then check budget for gpt-4o-mini (no mapping)
    await tracker.trackUsage('gpt-4o', 1000, 500)

    // gpt-4o-mini has no entry in downgradeMap -> should block
    const result = await tracker.checkBudget('gpt-4o-mini', {})
    expect(result.allowed).toBe(false)
    expect(result.action).toBe('block')
    expect(result.suggestedModel).toBeUndefined()
  })

  it('should block when downgrade-model has no downgradeMap at all', async () => {
    const tracker = createCostTracker({
      daily: 0.001,
      onExceeded: 'downgrade-model',
    })

    await tracker.trackUsage('gpt-4o', 1000, 500)

    const result = await tracker.checkBudget('gpt-4o', {})
    expect(result.allowed).toBe(false)
    expect(result.action).toBe('block')
  })

  it('should not count stale entries older than 32 days in getDailyCost', async () => {
    const storage = new Map<string, unknown>()
    const adapter = {
      getItem: async (key: string) => storage.get(key),
      setItem: async (key: string, value: unknown) => { storage.set(key, value) },
      removeItem: async (key: string) => { storage.delete(key) },
    }

    const tracker = createCostTracker({
      daily: 999,
      monthly: 999,
      onExceeded: 'block',
      store: adapter,
    })

    // Manually inject a stale entry (40 days old) into external store
    const staleTimestamp = Date.now() - (40 * 24 * 60 * 60 * 1000)
    await adapter.setItem('cost-entries', [
      { timestamp: staleTimestamp, model: 'gpt-4o', cost: 999 },
    ])

    // getDailyCost should prune the stale entry and return 0
    const daily = await tracker.getDailyCost()
    expect(daily).toBe(0)

    // getMonthlyCost should also prune and return 0
    const monthly = await tracker.getMonthlyCost()
    expect(monthly).toBe(0)
  })

  it('should handle external store returning non-array', async () => {
    const adapter = {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    }

    const tracker = createCostTracker({
      daily: 50,
      onExceeded: 'block',
      store: adapter,
    })

    const daily = await tracker.getDailyCost()
    expect(daily).toBe(0)
  })
})
