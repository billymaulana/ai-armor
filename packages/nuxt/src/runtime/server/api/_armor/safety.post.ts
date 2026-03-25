import { createError, defineEventHandler, getRequestHeader, getRequestIP, readBody } from 'h3'
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

  const body = await readBody(event)
  const armor = useArmorInstance()

  const text = typeof body?.text === 'string' ? body.text : ''
  const model = typeof body?.model === 'string' ? body.model : 'unknown'

  const request = {
    model,
    messages: [{ role: 'user', content: text }],
  }

  const ip = getRequestIP(event) ?? getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()

  const ctx = {
    ip,
    userId: getRequestHeader(event, 'x-user-id'),
  }

  return armor.checkSafety(request, ctx)
})
