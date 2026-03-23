import { describe, expect, it } from 'vitest'
import { findNonSerializableKeys, toSerializable } from '../../src/module'

describe('findNonSerializableKeys', () => {
  it('should return empty for plain object', () => {
    expect(findNonSerializableKeys({ a: 1, b: 'hello' })).toEqual([])
  })

  it('should detect functions', () => {
    const keys = findNonSerializableKeys({ onBlocked: () => {} })
    expect(keys).toEqual(['onBlocked (function)'])
  })

  it('should detect RegExp', () => {
    const keys = findNonSerializableKeys({ pattern: /test/i })
    expect(keys).toEqual(['pattern (RegExp)'])
  })

  it('should detect nested non-serializable', () => {
    const keys = findNonSerializableKeys({
      safety: {
        onBlocked: () => {},
        blockedPatterns: /abc/,
      },
    })
    expect(keys).toContain('safety.onBlocked (function)')
    expect(keys).toContain('safety.blockedPatterns (RegExp)')
  })

  it('should handle null/undefined input', () => {
    expect(findNonSerializableKeys(null)).toEqual([])
    expect(findNonSerializableKeys(undefined)).toEqual([])
  })

  it('should handle arrays (skip them)', () => {
    expect(findNonSerializableKeys([1, 2, 3])).toEqual([])
  })

  it('should handle deeply nested objects', () => {
    const keys = findNonSerializableKeys({ a: { b: { c: { fn: () => {} } } } })
    expect(keys).toEqual(['a.b.c.fn (function)'])
  })
})

describe('toSerializable', () => {
  it('should pass through plain objects unchanged', () => {
    const input = { rateLimit: { strategy: 'sliding-window', rules: [] } }
    expect(toSerializable(input)).toEqual(input)
  })

  it('should strip functions', () => {
    const result = toSerializable({ name: 'test', onBlocked: () => {} })
    expect(result).toEqual({ name: 'test' })
    expect(result).not.toHaveProperty('onBlocked')
  })

  it('should convert RegExp to empty object (JSON round-trip)', () => {
    const result = toSerializable({ enabled: true, pattern: /abc/ })
    // JSON.stringify converts RegExp to {} — toSerializable warns but cannot remove
    expect(result).toEqual({ enabled: true, pattern: {} })
  })

  it('should handle null input', () => {
    expect(toSerializable(null)).toEqual({})
  })

  it('should handle undefined input', () => {
    expect(toSerializable(undefined)).toEqual({})
  })

  it('should preserve nested serializable values', () => {
    const input = {
      budget: { daily: 10, monthly: 100, onExceeded: 'block' },
      routing: { aliases: { fast: 'gpt-4o-mini' } },
    }
    expect(toSerializable(input)).toEqual(input)
  })

  it('should strip undefined values (JSON round-trip)', () => {
    const result = toSerializable({ a: 1, b: undefined })
    expect(result).toEqual({ a: 1 })
  })
})
