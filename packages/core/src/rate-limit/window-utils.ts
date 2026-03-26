import type { ArmorContext, RateLimitConfig } from '../types'

export function parseWindow(window: string): number {
  const match = window.match(/^(\d+)([smhd])$/)
  if (!match) {
    throw new Error(`Invalid window format: "${window}". Use format like "1m", "1h", "1d"`)
  }

  const value = Number.parseInt(match[1]!, 10)
  if (value === 0) {
    throw new Error(`Invalid window format: "${window}". Window must be greater than 0`)
  }
  const unit = match[2]!

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  }

  return value * multipliers[unit]!
}

export function resolveKey(config: RateLimitConfig, ctx: ArmorContext, ruleKey: string): string {
  if (config.keyResolver) {
    return config.keyResolver(ctx, ruleKey)
  }

  switch (ruleKey) {
    case 'user':
      return ctx.userId ?? 'anonymous'
    case 'ip':
      return ctx.ip ?? 'unknown'
    case 'apiKey':
      return ctx.apiKey ?? 'unknown'
    default:
      if (Object.prototype.hasOwnProperty.call(ctx, ruleKey)) {
        return (ctx[ruleKey] as string) ?? 'unknown'
      }
      return 'unknown'
  }
}
