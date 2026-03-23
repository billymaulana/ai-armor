import type { ArmorContext, ArmorInstance, ArmorLog, ArmorRequest } from '../types'

interface HttpRequest {
  method?: string
  url?: string
  headers?: Record<string, string | string[] | undefined>
  body?: unknown
}

interface HttpResponse {
  status: (code: number) => HttpResponse
  json: (data: unknown) => void
  setHeader?: (name: string, value: string) => void
}

/**
 * Creates an HTTP middleware handler for ai-armor.
 * Compatible with Express, Connect, h3, and similar frameworks.
 *
 * Usage:
 * ```ts
 * import { createArmorHandler } from 'ai-armor/http'
 * app.use('/api/ai/*', createArmorHandler(armor))
 * ```
 */
export function createArmorHandler(armor: ArmorInstance, options?: {
  contextFromRequest?: (req: HttpRequest) => ArmorContext
}) {
  function extractContext(req: HttpRequest): ArmorContext {
    if (options?.contextFromRequest) {
      return options.contextFromRequest(req)
    }

    const headers = req.headers ?? {}
    const forwarded = headers['x-forwarded-for']
    const ip = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined
    const userId = typeof headers['x-user-id'] === 'string' ? headers['x-user-id'] : undefined
    const apiKey = typeof headers['x-api-key'] === 'string' ? headers['x-api-key'] : undefined

    const ctx: ArmorContext = {
      headers: Object.fromEntries(
        Object.entries(headers)
          .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
      ),
    }
    if (ip !== undefined)
      ctx.ip = ip
    if (userId !== undefined)
      ctx.userId = userId
    if (apiKey !== undefined)
      ctx.apiKey = apiKey

    return ctx
  }

  return async (req: HttpRequest, res: HttpResponse, next?: () => void) => {
    const ctx = extractContext(req)

    // Check safety on request body
    const body = req.body as Record<string, unknown> | undefined
    if (body) {
      const safetyRequest: ArmorRequest = {
        model: (body.model as string) ?? '',
        messages: (body.messages as unknown[]) ?? [],
      }
      const safetyResult = armor.checkSafety(safetyRequest, ctx)
      if (safetyResult.blocked) {
        res.status(403).json({
          error: 'Request blocked by safety guard',
          reason: safetyResult.reason,
        })
        return
      }
    }

    // Check rate limit
    const rateLimitResult = await armor.checkRateLimit(ctx)
    if (!rateLimitResult.allowed) {
      if (res.setHeader) {
        res.setHeader('X-RateLimit-Remaining', '0')
        res.setHeader('X-RateLimit-Reset', String(rateLimitResult.resetAt))
        res.setHeader('Retry-After', String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)))
      }
      res.status(429).json({
        error: 'Rate limit exceeded',
        resetAt: new Date(rateLimitResult.resetAt).toISOString(),
        remaining: 0,
      })
      return
    }

    // Set rate limit headers
    if (res.setHeader) {
      res.setHeader('X-RateLimit-Remaining', String(rateLimitResult.remaining))
      res.setHeader('X-RateLimit-Reset', String(rateLimitResult.resetAt))
    }

    // Extract model from request body
    const rawModel = (body?.model as string) ?? ''
    const resolvedModel = armor.resolveModel(rawModel)

    // Check budget
    const budgetResult = await armor.checkBudget(resolvedModel, ctx)
    if (!budgetResult.allowed) {
      res.status(402).json({
        error: 'Budget exceeded',
        action: budgetResult.action,
      })
      return
    }

    // Check cache
    if (body) {
      const request: ArmorRequest = {
        model: resolvedModel,
        messages: (body.messages as unknown[]) ?? [],
      }
      if (body.temperature !== undefined) {
        request.temperature = body.temperature as number
      }
      if (body.tools !== undefined) {
        request.tools = body.tools as unknown[]
      }

      const cached = await armor.getCachedResponse(request)
      if (cached) {
        const logEntry: ArmorLog = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          model: resolvedModel,
          provider: armor.getProvider(resolvedModel),
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          latency: 0,
          cached: true,
          fallback: false,
          rateLimited: false,
        }
        await armor.log(logEntry)

        res.status(200).json(cached)
        return
      }
    }

    // If budget suggests downgrade or model was aliased, create a modified body copy
    // (never mutate the original req.body -- downstream middleware may hold a reference)
    if (body && (budgetResult.suggestedModel || resolvedModel !== rawModel)) {
      const modifiedBody = { ...body }
      modifiedBody.model = budgetResult.suggestedModel ?? resolvedModel
      ;(req as Record<string, unknown>).body = modifiedBody
    }

    if (next) {
      next()
    }
  }
}
