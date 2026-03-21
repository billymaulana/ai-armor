import { describe, expect, it } from 'vitest'
import { createModelResolver } from '../../../src/routing/resolver'

describe('createModelResolver', () => {
  it('should resolve aliases to model IDs', () => {
    const resolver = createModelResolver({
      aliases: { fast: 'gpt-4o-mini', smart: 'claude-sonnet-4-6' },
    })

    expect(resolver.resolve('fast')).toBe('gpt-4o-mini')
    expect(resolver.resolve('smart')).toBe('claude-sonnet-4-6')
  })

  it('should return original model when no alias exists', () => {
    const resolver = createModelResolver({
      aliases: { fast: 'gpt-4o-mini' },
    })

    expect(resolver.resolve('gpt-4o')).toBe('gpt-4o')
  })

  it('should add new aliases dynamically', () => {
    const resolver = createModelResolver({ aliases: {} })

    resolver.addAlias('cheap', 'gpt-4o-mini')
    expect(resolver.resolve('cheap')).toBe('gpt-4o-mini')
  })

  it('should remove aliases', () => {
    const resolver = createModelResolver({
      aliases: { fast: 'gpt-4o-mini' },
    })

    resolver.removeAlias('fast')
    expect(resolver.resolve('fast')).toBe('fast')
  })

  it('should return all aliases', () => {
    const resolver = createModelResolver({
      aliases: { fast: 'gpt-4o-mini', smart: 'claude-sonnet-4-6' },
    })

    expect(resolver.getAliases()).toEqual({
      fast: 'gpt-4o-mini',
      smart: 'claude-sonnet-4-6',
    })
  })
})
