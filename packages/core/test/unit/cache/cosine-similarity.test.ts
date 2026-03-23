import { describe, expect, it } from 'vitest'
import { cosineSimilarity } from '../../../src/cache/cosine-similarity'

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const v = [1, 2, 3, 4]
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 10)
  })

  it('should return 0 for orthogonal vectors', () => {
    const a = [1, 0, 0]
    const b = [0, 1, 0]
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 10)
  })

  it('should return -1 for opposite vectors', () => {
    const a = [1, 2, 3]
    const b = [-1, -2, -3]
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 10)
  })

  it('should handle zero vectors (return 0)', () => {
    const zero = [0, 0, 0]
    const v = [1, 2, 3]
    expect(cosineSimilarity(zero, v)).toBe(0)
    expect(cosineSimilarity(v, zero)).toBe(0)
    expect(cosineSimilarity(zero, zero)).toBe(0)
  })

  it('should throw on dimension mismatch', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('Vector dimension mismatch: 2 vs 3')
  })

  it('should compute correct similarity for known vectors', () => {
    // Known example: cos(45deg) ~ 0.7071
    const a = [1, 0]
    const b = [1, 1]
    // cos(theta) = (1*1 + 0*1) / (1 * sqrt(2)) = 1/sqrt(2)
    expect(cosineSimilarity(a, b)).toBeCloseTo(1 / Math.sqrt(2), 10)
  })

  it('should handle single-element vectors', () => {
    expect(cosineSimilarity([3], [5])).toBeCloseTo(1, 10)
    expect(cosineSimilarity([3], [-5])).toBeCloseTo(-1, 10)
  })

  it('should handle empty vectors without throwing', () => {
    // Both empty: denominator = 0 => returns 0
    expect(cosineSimilarity([], [])).toBe(0)
  })
})
