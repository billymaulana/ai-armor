import { createError, defineEventHandler, getRequestHeaders, getRequestIP, setResponseHeader } from 'h3'
import { useArmorInstance } from '../utils/armor'

export default defineEventHandler(async (event) => {
  const headers = getRequestHeaders(event)

  // Use getRequestIP for safer IP extraction (respects Nitro proxy trust config)
  const ip = getRequestIP(event) ?? headers['x-forwarded-for']?.split(',')[0]?.trim()

  const ctx = {
    ip,
    userId: headers['x-user-id'],
    apiKey: headers['x-api-key'],
  }

  const armor = useArmorInstance()
  const result = await armor.checkRateLimit(ctx)

  setResponseHeader(event, 'X-RateLimit-Remaining', String(result.remaining))
  if (result.resetAt > 0) {
    setResponseHeader(event, 'X-RateLimit-Reset', String(result.resetAt))
  }

  if (!result.allowed) {
    setResponseHeader(event, 'Retry-After', String(Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000))))
    throw createError({
      statusCode: 429,
      statusMessage: 'Rate limit exceeded',
      statusText: 'Rate limit exceeded',
    })
  }
})
