/**
 * Example: ai-armor with Azure OpenAI (Microsoft)
 *
 * Azure OpenAI uses the OpenAI SDK with Azure-specific configuration.
 *
 * npm install ai-armor openai
 */

import { createArmor } from 'ai-armor'
import { AzureOpenAI } from 'openai'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [
      { key: 'user', limit: 30, window: '1m' },
      { key: 'apiKey', limit: 200, window: '1m' },
    ],
  },
  budget: {
    daily: 100.0,
    monthly: 2000.0,
    perUser: 20.0,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'gpt-4o-azure': 'gpt-4o-mini-azure',
    },
  },
  cache: { enabled: true, strategy: 'exact', ttl: 3600 },
  routing: {
    aliases: {
      fast: 'gpt-4o-mini-azure',
      smart: 'gpt-4o-azure',
    },
  },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency', 'userId'],
  },
})

// Azure OpenAI uses deployment names
const client = new AzureOpenAI({
  apiKey: 'your-azure-api-key',
  endpoint: 'https://your-resource.openai.azure.com',
  apiVersion: '2024-10-21',
})

async function chat(userId: string, model: string, message: string) {
  const ctx = { userId }
  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed)
    throw new Error('Rate limited')

  const resolvedModel = armor.resolveModel(model)
  const budget = await armor.checkBudget(resolvedModel, ctx)
  const finalModel = budget.suggestedModel ?? resolvedModel

  // Map ai-armor model name to Azure deployment name
  const deploymentMap: Record<string, string> = {
    'gpt-4o-azure': 'my-gpt4o-deployment',
    'gpt-4o-mini-azure': 'my-gpt4o-mini-deployment',
  }
  const deployment = deploymentMap[finalModel] ?? finalModel

  const request = { model: finalModel, messages: [{ role: 'user' as const, content: message }] }
  const cached = armor.getCachedResponse(request)
  if (cached)
    return cached as { content: string }

  const start = Date.now()
  const response = await client.chat.completions.create({
    model: deployment, // Azure uses deployment name, not model name
    messages: [{ role: 'user', content: message }],
    max_tokens: 1024,
  })
  const _latency = Date.now() - start
  const content = response.choices[0]?.message?.content ?? ''
  const inputTokens = response.usage?.prompt_tokens ?? 0
  const outputTokens = response.usage?.completion_tokens ?? 0

  // Track with ai-armor model name (not deployment name) for correct pricing
  await armor.trackCost(finalModel, inputTokens, outputTokens, userId)
  armor.setCachedResponse(request, { content })

  return { content }
}

async function main() {
  const result = await chat('user-1', 'smart', 'What is Azure OpenAI?')
  // eslint-disable-next-line no-console
  console.log(result.content)
}

main()
