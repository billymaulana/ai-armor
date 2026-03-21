import { describe, expect, it } from 'vitest'
import { calculateCost, getAllModels, getModelPricing, getProvider, pricingDatabase } from '../../../src/pricing/database'

describe('pricingDatabase', () => {
  it('should have at least 40 models', () => {
    expect(pricingDatabase.length).toBeGreaterThanOrEqual(40)
  })

  it('should have required fields for all models', () => {
    for (const entry of pricingDatabase) {
      expect(entry.model).toBeTruthy()
      expect(entry.provider).toBeTruthy()
      expect(entry.input).toBeGreaterThanOrEqual(0)
      expect(entry.output).toBeGreaterThanOrEqual(0)
    }
  })

  it('should include major providers', () => {
    const providers = new Set(pricingDatabase.map(p => p.provider))
    expect(providers.has('openai')).toBe(true)
    expect(providers.has('anthropic')).toBe(true)
    expect(providers.has('google')).toBe(true)
    expect(providers.has('mistral')).toBe(true)
  })
})

describe('getModelPricing', () => {
  it('should return pricing for known models', () => {
    const gpt4o = getModelPricing('gpt-4o')
    expect(gpt4o).toBeDefined()
    expect(gpt4o!.provider).toBe('openai')
    expect(gpt4o!.input).toBeGreaterThan(0)
    expect(gpt4o!.output).toBeGreaterThan(0)
  })

  it('should return undefined for unknown models', () => {
    expect(getModelPricing('nonexistent-model')).toBeUndefined()
  })
})

describe('calculateCost', () => {
  it('should calculate cost for known model', () => {
    // gpt-4o: input $2.50/1M, output $10.00/1M
    const cost = calculateCost('gpt-4o', 1000, 500)
    expect(cost).toBeCloseTo(0.0025 + 0.005, 6) // 0.0075
  })

  it('should return 0 for unknown model', () => {
    expect(calculateCost('unknown-model', 1000, 500)).toBe(0)
  })

  it('should handle zero tokens', () => {
    expect(calculateCost('gpt-4o', 0, 0)).toBe(0)
  })

  it('should calculate large token counts correctly', () => {
    // 1M input tokens + 1M output tokens for gpt-4o
    const cost = calculateCost('gpt-4o', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(2.50 + 10.00, 2) // $12.50
  })
})

describe('getProvider', () => {
  it('should return provider for known model', () => {
    expect(getProvider('gpt-4o')).toBe('openai')
    expect(getProvider('claude-sonnet-4-6')).toBe('anthropic')
    expect(getProvider('gemini-2.5-pro')).toBe('google')
  })

  it('should return unknown for unknown model', () => {
    expect(getProvider('nonexistent')).toBe('unknown')
  })
})

describe('getAllModels', () => {
  it('should return all model names', () => {
    const models = getAllModels()
    expect(models.length).toBe(pricingDatabase.length)
    expect(models).toContain('gpt-4o')
    expect(models).toContain('claude-sonnet-4-6')
  })
})
