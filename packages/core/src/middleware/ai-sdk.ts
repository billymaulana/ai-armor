import type { ArmorContext, ArmorInstance, ArmorLog, ArmorRequest } from '../types'
import { getProvider } from '../pricing/database'

/**
 * Creates a Vercel AI SDK middleware adapter for ai-armor.
 *
 * Usage:
 * ```ts
 * import { aiArmorMiddleware } from 'ai-armor/ai-sdk'
 * import { wrapLanguageModel } from 'ai'
 *
 * const protectedModel = wrapLanguageModel({
 *   model: openai('gpt-4o'),
 *   middleware: aiArmorMiddleware(armor, { userId: 'user-123' }),
 * })
 * ```
 */
export function aiArmorMiddleware(armor: ArmorInstance, ctx?: ArmorContext) {
  const context: ArmorContext = ctx ?? {}

  return {
    transformParams: async ({ params }: { params: Record<string, unknown> }) => {
      const model = (params.model as string) ?? ''
      const resolvedModel = armor.resolveModel(model)

      // Check rate limit
      const rateLimitResult = await armor.checkRateLimit(context)
      if (!rateLimitResult.allowed) {
        throw new Error(`[ai-armor] Rate limited. Resets at ${new Date(rateLimitResult.resetAt).toISOString()}`)
      }

      // Check budget
      const budgetResult = await armor.checkBudget(resolvedModel, context)
      if (!budgetResult.allowed) {
        throw new Error(`[ai-armor] Budget exceeded. Action: ${budgetResult.action}`)
      }

      // If budget suggests model downgrade, apply it
      const finalModel = budgetResult.suggestedModel ?? resolvedModel

      // Build request for cache lookup
      const request: ArmorRequest = {
        model: finalModel,
        messages: (params.messages as unknown[]) ?? [],
      }
      if (params.temperature !== undefined) {
        request.temperature = params.temperature as number
      }
      if (params.tools !== undefined) {
        request.tools = params.tools as unknown[]
      }

      const cached = armor.getCachedResponse(request)
      if (cached) {
        return {
          ...params,
          _armorCached: cached,
          _armorRequest: request,
          model: finalModel,
        }
      }

      return {
        ...params,
        _armorRequest: request,
        model: finalModel,
      }
    },

    wrapGenerate: async ({ doGenerate, params }: { doGenerate: () => Promise<unknown>, params: Record<string, unknown> }) => {
      const startTime = Date.now()
      const request = params._armorRequest as ArmorRequest | undefined
      const cached = params._armorCached as unknown | undefined

      if (cached) {
        const logEntry: ArmorLog = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          model: request?.model ?? '',
          provider: getProvider(request?.model ?? ''),
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          latency: 0,
          cached: true,
          fallback: false,
          rateLimited: false,
        }
        await armor.log(logEntry)
        return cached
      }

      const model = request?.model ?? ''
      let result: Record<string, unknown>

      try {
        result = await doGenerate() as Record<string, unknown>
      }
      catch (err) {
        // Log failed requests for observability
        const failLog: ArmorLog = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          model,
          provider: getProvider(model),
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          latency: Date.now() - startTime,
          cached: false,
          fallback: false,
          rateLimited: false,
          blocked: String(err),
        }
        if (context.userId !== undefined) {
          failLog.userId = context.userId
        }
        await armor.log(failLog)
        throw err
      }

      const latency = Date.now() - startTime
      const usage = result.usage as { promptTokens?: number, completionTokens?: number } | undefined
      const inputTokens = usage?.promptTokens ?? 0
      const outputTokens = usage?.completionTokens ?? 0

      // Track cost
      await armor.trackCost(model, inputTokens, outputTokens, context.userId)

      // Cache the response -- only cache successful results
      const finishReason = result.finishReason as string | undefined
      if (request && finishReason !== 'error') {
        armor.setCachedResponse(request, result)
      }

      // Log
      const logEntry: ArmorLog = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        model,
        provider: getProvider(model),
        inputTokens,
        outputTokens,
        cost: armor.estimateCost(model, inputTokens, outputTokens),
        latency,
        cached: false,
        fallback: false,
        rateLimited: false,
      }
      if (context.userId !== undefined) {
        logEntry.userId = context.userId
      }
      await armor.log(logEntry)

      return result
    },
  }
}
