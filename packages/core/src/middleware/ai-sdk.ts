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

  // WeakMap keyed by the params object returned from transformParams.
  // The same object reference is passed to wrapGenerate by the AI SDK,
  // so we can retrieve per-request state without leaking internal keys
  // into the provider params. WeakMap also prevents memory leaks --
  // entries are GC'd when the params object is no longer referenced.
  const pendingStates = new WeakMap<Record<string, unknown>, { request: ArmorRequest, cached: unknown }>()

  return {
    transformParams: async ({ params }: { params: Record<string, unknown> }) => {
      const model = (params.model as string) ?? ''
      const resolvedModel = armor.resolveModel(model)

      // Build request early for safety check
      const request: ArmorRequest = {
        model: resolvedModel,
        messages: (params.messages as unknown[]) ?? [],
      }
      if (params.temperature !== undefined) {
        request.temperature = params.temperature as number
      }
      if (params.tools !== undefined) {
        request.tools = params.tools as unknown[]
      }

      // Check safety first (reject bad requests early)
      const safetyResult = armor.checkSafety(request, context)
      if (safetyResult.blocked) {
        throw new Error(`[ai-armor] Safety blocked: ${safetyResult.reason}`)
      }

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
      request.model = finalModel

      // Create a clean params object (no internal keys leak to provider)
      const returnParams = {
        ...params,
        model: finalModel,
      }

      // Store per-request state keyed by the params object identity
      pendingStates.set(returnParams, {
        request,
        cached: armor.getCachedResponse(request),
      })

      return returnParams
    },

    wrapGenerate: async ({ doGenerate, params }: { doGenerate: () => Promise<unknown>, params: Record<string, unknown> }) => {
      const startTime = Date.now()

      // Retrieve per-request state via object identity
      const state = pendingStates.get(params)
      if (state)
        pendingStates.delete(params)
      const request = state?.request
      const cached = state?.cached

      if (cached && request) {
        const logEntry: ArmorLog = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          model: request.model,
          provider: getProvider(request.model),
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          latency: 0,
          cached: true,
          fallback: false,
          rateLimited: false,
        }
        if (context.userId !== undefined) {
          logEntry.userId = context.userId
        }
        await armor.log(logEntry)
        return cached
      }

      const model = request?.model ?? (params.model as string) ?? ''
      let result: Record<string, unknown>

      try {
        result = await doGenerate() as Record<string, unknown>
      }
      catch (err) {
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

      await armor.trackCost(model, inputTokens, outputTokens, context.userId)

      const finishReason = result.finishReason as string | undefined
      if (request && finishReason !== 'error') {
        armor.setCachedResponse(request, result)
      }

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

    wrapStream: async ({ doStream, params }: { doStream: () => Promise<Record<string, unknown>>, params: Record<string, unknown> }) => {
      const startTime = Date.now()

      const state = pendingStates.get(params)
      if (state)
        pendingStates.delete(params)
      const request = state?.request
      const model = request?.model ?? (params.model as string) ?? ''

      const result = await doStream()
      const originalStream = result.stream as ReadableStream

      let inputTokens = 0
      let outputTokens = 0

      const transformedStream = originalStream.pipeThrough(
        new TransformStream({
          transform(chunk: Record<string, unknown>, controller) {
            controller.enqueue(chunk)
            // Capture usage from step-finish / finish stream parts
            if (chunk.type === 'step-finish' || chunk.type === 'finish') {
              const usage = chunk.usage as { promptTokens?: number, completionTokens?: number } | undefined
              if (usage) {
                inputTokens = usage.promptTokens ?? inputTokens
                outputTokens = usage.completionTokens ?? outputTokens
              }
            }
          },
          async flush() {
            const latency = Date.now() - startTime
            await armor.trackCost(model, inputTokens, outputTokens, context.userId)
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
          },
        }),
      )

      return { ...result, stream: transformedStream }
    },
  }
}
