import { useArmorInstance } from '#ai-armor/server'
import { mockAIGenerate } from '../utils/mock-ai'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ prompt?: string, model?: string, userId?: string }>(event)

  if (!body?.prompt) {
    throw createError({ statusCode: 400, statusMessage: 'Missing "prompt" field' })
  }

  const armor = useArmorInstance()
  const userId = body.userId ?? 'demo-user'
  const ctx = {
    userId,
    ip: getRequestIP(event) ?? '127.0.0.1',
  }

  // 1. Rate limit check
  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Rate limited',
      data: { resetAt: new Date(rateLimit.resetAt).toISOString(), remaining: rateLimit.remaining },
    })
  }

  // 2. Safety check
  const requestModel = body.model ?? 'fast'
  const resolvedModel = armor.resolveModel(requestModel)
  const request = { model: resolvedModel, messages: [{ content: body.prompt }] }

  const safety = armor.checkSafety(request, ctx)
  if (safety.blocked) {
    throw createError({
      statusCode: 422,
      statusMessage: `Safety blocked: ${safety.reason}`,
      data: { reason: safety.reason, details: safety.details },
    })
  }

  // 3. Budget check
  const budget = await armor.checkBudget(resolvedModel, ctx)
  if (!budget.allowed) {
    throw createError({
      statusCode: 402,
      statusMessage: 'Budget exceeded',
      data: { action: budget.action },
    })
  }
  const finalModel = budget.suggestedModel ?? resolvedModel

  // 4. Cache check
  const cacheRequest = { model: finalModel, messages: [{ content: body.prompt }] }
  const cached = armor.getCachedResponse(cacheRequest)
  if (cached) {
    return { ...(cached as Record<string, unknown>), model: finalModel, cached: true }
  }

  // 5. Generate (mock -- replace with real AI provider in production)
  const result = mockAIGenerate(body.prompt, finalModel)

  // 6. Track cost + cache + log
  await armor.trackCost(finalModel, result.inputTokens, result.outputTokens, userId)
  armor.setCachedResponse(cacheRequest, { content: result.content })

  await armor.log({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    model: finalModel,
    provider: finalModel.startsWith('claude') ? 'anthropic' : 'openai',
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    cost: armor.estimateCost(finalModel, result.inputTokens, result.outputTokens),
    latency: result.latency,
    cached: false,
    fallback: finalModel !== resolvedModel,
    rateLimited: false,
    userId,
  })

  return {
    content: result.content,
    model: finalModel,
    cached: false,
    usage: {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cost: armor.estimateCost(finalModel, result.inputTokens, result.outputTokens),
      latency: result.latency,
    },
  }
})
