import { describe, expect, it } from 'vitest'
import { createArmor } from '../../src/create-armor'

describe('createArmor', () => {
  it('should create an armor instance with config', () => {
    const armor = createArmor({
      routing: {
        aliases: { fast: 'gpt-4o-mini', smart: 'claude-sonnet-4-6' },
      },
    })

    expect(armor.config).toBeDefined()
    expect(armor.config.routing?.aliases).toEqual({
      fast: 'gpt-4o-mini',
      smart: 'claude-sonnet-4-6',
    })
  })

  it('should resolve model aliases', () => {
    const armor = createArmor({
      routing: {
        aliases: { fast: 'gpt-4o-mini', smart: 'claude-sonnet-4-6' },
      },
    })

    expect(armor.resolveModel('fast')).toBe('gpt-4o-mini')
    expect(armor.resolveModel('smart')).toBe('claude-sonnet-4-6')
    expect(armor.resolveModel('gpt-4o')).toBe('gpt-4o')
  })

  it('should return model as-is when no routing configured', () => {
    const armor = createArmor({})
    expect(armor.resolveModel('gpt-4o')).toBe('gpt-4o')
  })

  it('should create instance with empty config', () => {
    const armor = createArmor({})
    expect(armor.config).toEqual({})
    expect(armor.resolveModel('any-model')).toBe('any-model')
  })
})
