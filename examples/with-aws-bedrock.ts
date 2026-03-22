/**
 * Example: ai-armor with AWS Bedrock
 *
 * AWS Bedrock uses the AWS SDK (not OpenAI-compatible).
 * Supports Claude, Llama, Amazon Nova, Cohere, and more.
 *
 * npm install ai-armor @aws-sdk/client-bedrock-runtime
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { createArmor } from 'ai-armor'

const armor = createArmor({
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 50, window: '1m' }],
  },
  budget: {
    daily: 200.0,
    perUser: 30.0,
    onExceeded: 'downgrade-model',
    downgradeMap: {
      'amazon.nova-pro-v1:0': 'amazon.nova-lite-v1:0',
      'amazon.nova-lite-v1:0': 'amazon.nova-micro-v1:0',
    },
  },
  cache: { enabled: true, strategy: 'exact', ttl: 3600, driver: 'memory' },
  routing: {
    aliases: {
      'nova-pro': 'amazon.nova-pro-v1:0',
      'nova-lite': 'amazon.nova-lite-v1:0',
      'nova-micro': 'amazon.nova-micro-v1:0',
    },
  },
  logging: {
    enabled: true,
    include: ['model', 'tokens', 'cost', 'latency', 'userId'],
  },
})

const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' })

async function chat(userId: string, model: string, message: string) {
  const ctx = { userId }
  const rateLimit = await armor.checkRateLimit(ctx)
  if (!rateLimit.allowed)
    throw new Error('Rate limited')

  const resolvedModel = armor.resolveModel(model)
  const budget = await armor.checkBudget(resolvedModel, ctx)
  const finalModel = budget.suggestedModel ?? resolvedModel

  const request = { model: finalModel, messages: [{ role: 'user' as const, content: message }] }
  const cached = armor.getCachedResponse(request)
  if (cached)
    return cached as { content: string }

  const start = Date.now()
  const command = new InvokeModelCommand({
    modelId: finalModel,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      messages: [{ role: 'user', content: [{ text: message }] }],
      inferenceConfig: { maxTokens: 1024 },
    }),
  })

  const response = await bedrock.send(command)
  const _latency = Date.now() - start
  const body = JSON.parse(new TextDecoder().decode(response.body)) as {
    output: { message: { content: Array<{ text: string }> } }
    usage: { inputTokens: number, outputTokens: number }
  }

  const content = body.output.message.content[0]?.text ?? ''
  const inputTokens = body.usage.inputTokens
  const outputTokens = body.usage.outputTokens

  await armor.trackCost(finalModel, inputTokens, outputTokens, userId)
  armor.setCachedResponse(request, { content })

  return { content }
}

async function main() {
  const result = await chat('user-1', 'nova-pro', 'What is AWS Bedrock?')
  // eslint-disable-next-line no-console
  console.log(result.content)
}

main()
