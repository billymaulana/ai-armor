import { createError, defineEventHandler, getRequestHeader, getRequestIP } from 'h3'
import { useRuntimeConfig } from '#imports'
import { useArmorInstance } from '../../utils/armor'

export default defineEventHandler(async (event) => {
  // If adminSecret is configured, require it via header
  const config = useRuntimeConfig(event)
  const expected = (config.aiArmor as Record<string, unknown>)?.adminSecret as string | undefined

  if (expected) {
    const provided = getRequestHeader(event, 'x-armor-admin-secret')
    if (provided !== expected) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden', statusText: 'Forbidden' })
    }
  }

  const armor = useArmorInstance()

  // Use getRequestIP for safer IP extraction (respects proxy config)
  const ip = getRequestIP(event) ?? getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()

  const ctx = {
    ip,
    userId: getRequestHeader(event, 'x-user-id'),
    apiKey: getRequestHeader(event, 'x-api-key'),
  }

  const rateLimitResult = await armor.peekRateLimit(ctx)

  return {
    healthy: true,
    rateLimitRemaining: rateLimitResult.remaining,
    rateLimitResetAt: rateLimitResult.resetAt > 0
      ? new Date(rateLimitResult.resetAt).toISOString()
      : null,
  }
})
