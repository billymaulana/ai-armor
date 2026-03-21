import type { ArmorContext } from '../../src/types'

export function createTestContext(overrides?: Partial<ArmorContext>): ArmorContext {
  return {
    userId: 'test-user',
    ip: '127.0.0.1',
    model: 'gpt-4o',
    ...overrides,
  }
}
