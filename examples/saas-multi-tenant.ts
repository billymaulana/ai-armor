/**
 * Example: SaaS multi-tenant AI platform with per-tenant rate limiting
 *
 * Demonstrates a production pattern for SaaS platforms where different
 * subscription tiers (free, pro, enterprise) get different rate limits,
 * budgets, and model access. Includes webhook notification on budget warnings.
 *
 * npm install ai-armor openai
 */

import type { ArmorInstance } from 'ai-armor'
import process from 'node:process'
import { createArmor } from 'ai-armor'
import OpenAI from 'openai'

// --- Tenant tier definitions ---
interface TenantConfig {
  tier: 'free' | 'pro' | 'enterprise'
  rateLimit: number
  dailyBudget: number
  perUserBudget: number
  allowedModels: string[]
  onExceeded: 'block' | 'downgrade-model'
}

const TIER_CONFIG: Record<string, TenantConfig> = {
  free: {
    tier: 'free',
    rateLimit: 10,
    dailyBudget: 1.0,
    perUserBudget: 0.25,
    allowedModels: ['gpt-4o-mini', 'gemini-2.0-flash'],
    onExceeded: 'block',
  },
  pro: {
    tier: 'pro',
    rateLimit: 60,
    dailyBudget: 25.0,
    perUserBudget: 5.0,
    allowedModels: ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4-20250514', 'gemini-2.5-flash'],
    onExceeded: 'downgrade-model',
  },
  enterprise: {
    tier: 'enterprise',
    rateLimit: 500,
    dailyBudget: 500.0,
    perUserBudget: 100.0,
    allowedModels: ['gpt-4o', 'o1', 'o3-mini', 'claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'gemini-2.5-pro'],
    onExceeded: 'downgrade-model',
  },
}

// --- Webhook notification stub ---
async function sendBudgetWebhook(tenantId: string, payload: {
  type: 'budget_warning' | 'budget_exceeded'
  daily: number
  monthly: number
  perUserDaily?: number
}) {
  const webhookUrl = process.env.WEBHOOK_URL ?? 'https://hooks.example.com/ai-budget'

  // In production, use fetch() to POST to your webhook endpoint
  // eslint-disable-next-line no-console
  console.log(`[webhook] POST ${webhookUrl}`, { tenantId, ...payload })
}

// --- Create armor instance per tenant tier ---
function createTenantArmor(tenantId: string, tierName: string): ArmorInstance {
  const tier = TIER_CONFIG[tierName] ?? TIER_CONFIG.free!

  return createArmor({
    rateLimit: {
      strategy: 'sliding-window',
      rules: [
        { key: 'user', limit: tier.rateLimit, window: '1m' },
        { key: 'tenant', limit: tier.rateLimit * 10, window: '1m' },
      ],
      keyResolver: (ctx, ruleKey) => {
        if (ruleKey === 'tenant')
          return `tenant:${tenantId}`
        return `tenant:${tenantId}:${ctx.userId ?? 'anon'}`
      },
    },
    budget: {
      daily: tier.dailyBudget,
      perUser: tier.perUserBudget,
      onExceeded: tier.onExceeded,
      downgradeMap: {
        'gpt-4o': 'gpt-4o-mini',
        'o1': 'o3-mini',
        'claude-opus-4-20250514': 'claude-sonnet-4-20250514',
        'claude-sonnet-4-20250514': 'claude-haiku-4-5-20251001',
        'gemini-2.5-pro': 'gemini-2.5-flash',
        'gemini-2.5-flash': 'gemini-2.0-flash',
      },
      onWarned: (_ctx, budget) => {
        sendBudgetWebhook(tenantId, {
          type: 'budget_warning',
          daily: budget.daily,
          monthly: budget.monthly,
          perUserDaily: budget.perUserDaily,
        })
      },
    },
    cache: {
      enabled: true,
      strategy: 'exact',
      ttl: tier.tier === 'free' ? 3600 : 1800,
      maxSize: tier.tier === 'enterprise' ? 10000 : 1000,
    },
    routing: {
      aliases: {
        fast: 'gpt-4o-mini',
        smart: 'gpt-4o',
        reasoning: 'o1',
      },
    },
    logging: {
      enabled: true,
      include: ['model', 'tokens', 'cost', 'latency', 'cached', 'userId'],
    },
  })
}

// --- Tenant armor registry ---
const tenantArmors = new Map<string, ArmorInstance>()

function getArmorForTenant(tenantId: string, tier: string): ArmorInstance {
  const key = `${tenantId}:${tier}`
  let armor = tenantArmors.get(key)
  if (!armor) {
    armor = createTenantArmor(tenantId, tier)
    tenantArmors.set(key, armor)
  }
  return armor
}

// --- Model access validation ---
function validateModelAccess(tier: string, model: string): boolean {
  const config = TIER_CONFIG[tier]
  if (!config)
    return false
  return config.allowedModels.includes(model)
}

// --- Protected tenant chat ---
const openai = new OpenAI()

async function tenantChat(
  tenantId: string,
  tier: string,
  userId: string,
  model: string,
  message: string,
) {
  const armor = getArmorForTenant(tenantId, tier)
  const ctx = { userId, tenantId }

  // 1. Rate limit
  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed) {
    return {
      error: 'rate_limited',
      retryAfter: new Date(rateLimit.resetAt).toISOString(),
      remaining: rateLimit.remaining,
    }
  }

  // 2. Resolve model alias
  const resolvedModel = armor.resolveModel(model)

  // 3. Validate tier access
  if (!validateModelAccess(tier, resolvedModel)) {
    return {
      error: 'model_not_allowed',
      message: `Model "${resolvedModel}" is not available on the ${tier} tier`,
    }
  }

  // 4. Budget check (may downgrade for pro/enterprise, blocks for free)
  const budget = await armor.checkBudget(resolvedModel, ctx)
  if (!budget.allowed) {
    await sendBudgetWebhook(tenantId, {
      type: 'budget_exceeded',
      daily: 0,
      monthly: 0,
    })
    return { error: 'budget_exceeded', tier }
  }
  const finalModel = budget.suggestedModel ?? resolvedModel

  // 5. Cache check
  const request = { model: finalModel, messages: [{ role: 'user' as const, content: message }] }
  const cached = armor.getCachedResponse(request)
  if (cached) {
    return { ...(cached as { content: string }), cached: true, model: finalModel, tier }
  }

  // 6. Call OpenAI
  const start = Date.now()
  const response = await openai.chat.completions.create({
    model: finalModel,
    messages: [{ role: 'user', content: message }],
    max_tokens: tier === 'free' ? 512 : tier === 'pro' ? 2048 : 4096,
  })
  const latency = Date.now() - start

  const content = response.choices[0]?.message?.content ?? ''
  const inputTokens = response.usage?.prompt_tokens ?? 0
  const outputTokens = response.usage?.completion_tokens ?? 0

  // 7. Track cost
  await armor.trackCost(finalModel, inputTokens, outputTokens, userId)
  armor.setCachedResponse(request, { content })

  // 8. Log with tenant context
  await armor.log({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    model: finalModel,
    provider: 'openai',
    inputTokens,
    outputTokens,
    cost: armor.estimateCost(finalModel, inputTokens, outputTokens),
    latency,
    cached: false,
    fallback: finalModel !== resolvedModel,
    rateLimited: false,
    userId: `${tenantId}:${userId}`,
  })

  return { content, cached: false, model: finalModel, tier }
}

// --- Usage ---
async function main() {
  // Free tier user: limited to gpt-4o-mini, 10 req/min, $1/day
  const _freeResult = await tenantChat('tenant-acme', 'free', 'user-1', 'gpt-4o-mini', 'Summarize this document')

  // Pro tier user: can use gpt-4o, downgrades on budget pressure
  const _proResult = await tenantChat('tenant-bigco', 'pro', 'user-2', 'smart', 'Analyze our Q4 revenue trends')

  // Enterprise: full model access, high limits
  const _entResult = await tenantChat('tenant-megacorp', 'enterprise', 'user-3', 'reasoning', 'Design a distributed caching architecture')

  // Show per-tenant usage
  for (const [key, armor] of tenantArmors) {
    const logs = armor.getLogs()
    const totalCost = logs.reduce((sum, l) => sum + l.cost, 0)
    // eslint-disable-next-line no-console
    console.log(`[${key}] requests=${logs.length} cost=$${totalCost.toFixed(4)}`)
  }
}

main()
