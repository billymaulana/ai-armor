import type { ArmorLog } from '../../../src/types'
import { describe, expect, it, vi } from 'vitest'
import { createLogger } from '../../../src/logging/logger'

function makeLog(overrides?: Partial<ArmorLog>): ArmorLog {
  return {
    id: 'log-1',
    timestamp: Date.now(),
    model: 'gpt-4o',
    provider: 'openai',
    inputTokens: 100,
    outputTokens: 50,
    cost: 0.0075,
    latency: 250,
    cached: false,
    fallback: false,
    rateLimited: false,
    ...overrides,
  }
}

describe('createLogger', () => {
  it('should log entries when enabled', async () => {
    const logger = createLogger({
      enabled: true,
      include: ['model', 'tokens', 'cost', 'latency'],
    })

    await logger.log(makeLog())
    expect(logger.getLogs()).toHaveLength(1)
  })

  it('should not log when disabled', async () => {
    const logger = createLogger({
      enabled: false,
      include: ['model'],
    })

    await logger.log(makeLog())
    expect(logger.getLogs()).toHaveLength(0)
  })

  it('should call onRequest callback', async () => {
    const onRequest = vi.fn()
    const logger = createLogger({
      enabled: true,
      include: ['model'],
      onRequest,
    })

    const entry = makeLog()
    await logger.log(entry)

    expect(onRequest).toHaveBeenCalledOnce()
    expect(onRequest).toHaveBeenCalledWith(entry)
  })

  it('should filter logs based on include fields', () => {
    const logger = createLogger({
      enabled: true,
      include: ['model', 'cost'],
    })

    logger.log(makeLog())

    const filtered = logger.getFilteredLogs()
    expect(filtered).toHaveLength(1)
    expect(filtered[0]!.model).toBe('gpt-4o')
    expect(filtered[0]!.cost).toBe(0.0075)
    expect(filtered[0]!.latency).toBeUndefined()
    expect(filtered[0]!.inputTokens).toBeUndefined()
  })

  it('should return full logs via getLogs', async () => {
    const logger = createLogger({
      enabled: true,
      include: ['model'],
    })

    const entry = makeLog()
    await logger.log(entry)

    const logs = logger.getLogs()
    expect(logs[0]).toEqual(entry)
  })

  it('should clear logs', async () => {
    const logger = createLogger({
      enabled: true,
      include: ['model'],
    })

    await logger.log(makeLog())
    await logger.log(makeLog({ id: 'log-2' }))
    expect(logger.getLogs()).toHaveLength(2)

    logger.clear()
    expect(logger.getLogs()).toHaveLength(0)
  })

  it('should handle async onRequest callback', async () => {
    const results: string[] = []
    const logger = createLogger({
      enabled: true,
      include: ['model'],
      onRequest: async (log) => {
        results.push(log.model)
      },
    })

    await logger.log(makeLog({ model: 'gpt-4o' }))
    await logger.log(makeLog({ model: 'claude-sonnet-4-6', id: 'log-2' }))

    expect(results).toEqual(['gpt-4o', 'claude-sonnet-4-6'])
  })

  it('should filter cached field in getFilteredLogs', () => {
    const logger = createLogger({
      enabled: true,
      include: ['cached'],
    })

    logger.log(makeLog({ cached: true }))

    const filtered = logger.getFilteredLogs()
    expect(filtered[0]!.cached).toBe(true)
    expect(filtered[0]!.model).toBeUndefined()
  })

  it('should filter fallback field in getFilteredLogs', () => {
    const logger = createLogger({
      enabled: true,
      include: ['fallback'],
    })

    logger.log(makeLog({ fallback: true }))

    const filtered = logger.getFilteredLogs()
    expect(filtered[0]!.fallback).toBe(true)
    expect(filtered[0]!.model).toBeUndefined()
  })

  it('should filter userId field in getFilteredLogs', () => {
    const logger = createLogger({
      enabled: true,
      include: ['userId'],
    })

    logger.log(makeLog({ userId: 'user-1' }))

    const filtered = logger.getFilteredLogs()
    expect(filtered[0]!.userId).toBe('user-1')
    expect(filtered[0]!.model).toBeUndefined()
  })

  it('should not include userId when undefined in log entry', () => {
    const logger = createLogger({
      enabled: true,
      include: ['userId'],
    })

    logger.log(makeLog())

    const filtered = logger.getFilteredLogs()
    expect(filtered[0]!.userId).toBeUndefined()
  })

  it('should filter tokens field in getFilteredLogs', () => {
    const logger = createLogger({
      enabled: true,
      include: ['tokens'],
    })

    logger.log(makeLog({ inputTokens: 200, outputTokens: 80 }))

    const filtered = logger.getFilteredLogs()
    expect(filtered[0]!.inputTokens).toBe(200)
    expect(filtered[0]!.outputTokens).toBe(80)
    expect(filtered[0]!.model).toBeUndefined()
  })

  it('should filter latency field in getFilteredLogs', () => {
    const logger = createLogger({
      enabled: true,
      include: ['latency'],
    })

    logger.log(makeLog({ latency: 500 }))

    const filtered = logger.getFilteredLogs()
    expect(filtered[0]!.latency).toBe(500)
    expect(filtered[0]!.model).toBeUndefined()
  })

  it('should return full log when include is empty', () => {
    const logger = createLogger({
      enabled: true,
      include: [],
    })

    const entry = makeLog()
    logger.log(entry)

    const filtered = logger.getFilteredLogs()
    expect(filtered[0]).toEqual(entry)
  })

  it('should not crash when onRequest callback throws', async () => {
    const logger = createLogger({
      enabled: true,
      include: ['model'],
      onRequest: async () => { throw new Error('logging sink down') },
    })

    // Should not throw — logging errors are swallowed
    await logger.log(makeLog())

    expect(logger.getLogs()).toHaveLength(1)
  })

  it('should prune old entries when maxEntries exceeded', async () => {
    const logger = createLogger({
      enabled: true,
      include: ['model'],
      maxEntries: 3,
    })

    await logger.log(makeLog({ id: 'log-1', model: 'model-1' }))
    await logger.log(makeLog({ id: 'log-2', model: 'model-2' }))
    await logger.log(makeLog({ id: 'log-3', model: 'model-3' }))
    await logger.log(makeLog({ id: 'log-4', model: 'model-4' }))

    const logs = logger.getLogs()
    expect(logs).toHaveLength(3)
    // Oldest entry (log-1) should be pruned
    expect(logs[0]!.id).toBe('log-2')
    expect(logs[2]!.id).toBe('log-4')
  })
})
