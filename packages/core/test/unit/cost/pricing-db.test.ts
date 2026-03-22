import { afterEach, describe, expect, it } from 'vitest'
import { addModel, calculateCost, getAllModels, getModelPricing, getProvider, pricingDatabase, registerModels, removeModel, resetPricing, updateModel } from '../../../src/pricing/database'

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

describe('dynamic pricing', () => {
  afterEach(() => {
    resetPricing()
  })

  const testModel = { model: 'test-model-x', provider: 'test-provider', input: 1.00, output: 5.00 }

  it('should add a new model', () => {
    addModel(testModel)
    const pricing = getModelPricing('test-model-x')
    expect(pricing).toBeDefined()
    expect(pricing!.provider).toBe('test-provider')
    expect(pricing!.input).toBe(1.00)
    expect(pricing!.output).toBe(5.00)
  })

  it('should throw when adding duplicate model', () => {
    addModel(testModel)
    expect(() => addModel(testModel)).toThrow('Model "test-model-x" already exists in pricing database')
  })

  it('should update existing model pricing', () => {
    addModel(testModel)
    updateModel('test-model-x', { input: 2.00, output: 8.00 })
    const updated = getModelPricing('test-model-x')
    expect(updated!.input).toBe(2.00)
    expect(updated!.output).toBe(8.00)
    expect(updated!.provider).toBe('test-provider')
  })

  it('should throw when updating non-existent model', () => {
    expect(() => updateModel('no-such-model', { input: 1.00 })).toThrow('Model "no-such-model" not found in pricing database')
  })

  it('should remove existing model', () => {
    addModel(testModel)
    expect(removeModel('test-model-x')).toBe(true)
    expect(getModelPricing('test-model-x')).toBeUndefined()
  })

  it('should return false when removing non-existent model', () => {
    expect(removeModel('no-such-model')).toBe(false)
  })

  it('should reset pricing to defaults', () => {
    addModel(testModel)
    removeModel('gpt-4o')
    resetPricing()
    expect(getModelPricing('test-model-x')).toBeUndefined()
    expect(getModelPricing('gpt-4o')).toBeDefined()
  })

  it('should batch register models (overwrite existing)', () => {
    const batch = [
      { model: 'gpt-4o', provider: 'openai', input: 99.00, output: 99.00 },
      { model: 'custom-model', provider: 'custom', input: 0.50, output: 1.00 },
    ]
    registerModels(batch)
    expect(getModelPricing('gpt-4o')!.input).toBe(99.00)
    expect(getModelPricing('custom-model')!.provider).toBe('custom')
  })

  it('should include runtime-added models in getAllModels()', () => {
    addModel(testModel)
    const models = getAllModels()
    expect(models).toContain('test-model-x')
  })

  it('should calculate cost for runtime-added models', () => {
    addModel(testModel)
    // input: $1.00/1M, output: $5.00/1M
    const cost = calculateCost('test-model-x', 1_000_000, 1_000_000)
    expect(cost).toBeCloseTo(6.00, 2)
  })
})
