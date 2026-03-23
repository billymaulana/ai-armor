import type { ArmorInstance } from 'ai-armor'
import { beforeEach, describe, expect, it } from 'vitest'
import { _resetArmor, initArmor, useArmorInstance } from '../../src/runtime/server/utils/armor'

function createStubInstance(overrides: Partial<ArmorInstance> = {}): ArmorInstance {
  return {
    config: {},
    checkRateLimit: async () => ({ allowed: true, remaining: 10, resetAt: 0 }),
    peekRateLimit: async () => ({ remaining: 10, resetAt: 0 }),
    trackCost: async () => {},
    checkBudget: async () => ({ allowed: true, action: 'pass' }),
    getDailyCost: async () => 0,
    getMonthlyCost: async () => 0,
    resolveModel: m => m,
    getCachedResponse: async () => undefined,
    setCachedResponse: async () => {},
    log: async () => {},
    getLogs: () => [],
    estimateCost: () => 0,
    checkSafety: () => ({ allowed: true, blocked: false, reason: null, details: [] }),
    executeFallback: async (_req, handler) => ({ result: await handler('m'), model: 'm', attempts: 1, fallbackUsed: false }),
    ...overrides,
  }
}

describe('initArmor / useArmorInstance', () => {
  beforeEach(() => {
    _resetArmor()
  })

  it('should throw when instance not initialized', () => {
    expect(() => useArmorInstance()).toThrow('[ai-armor] Armor instance not initialized')
  })

  it('should return instance after init', () => {
    const instance = createStubInstance()
    initArmor(instance)
    expect(useArmorInstance()).toBe(instance)
  })

  it('should replace instance on second init call', () => {
    const first = createStubInstance()
    const second = createStubInstance()
    initArmor(first)
    initArmor(second)
    expect(useArmorInstance()).toBe(second)
  })

  it('should reset to uninitialized state', () => {
    initArmor(createStubInstance())
    _resetArmor()
    expect(() => useArmorInstance()).toThrow()
  })
})
