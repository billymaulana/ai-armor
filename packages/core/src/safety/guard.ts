import type { ArmorContext, ArmorRequest, SafetyCheckResult, SafetyConfig } from '../types'
import { encode } from 'gpt-tokenizer'
import { checkInjection, checkPII } from './patterns'

interface MessageContent {
  type?: string
  text?: string
}

interface MessageLike {
  content?: string | MessageContent[] | unknown
}

function extractText(messages: unknown[]): string {
  const parts: string[] = []

  for (const msg of messages) {
    if (typeof msg === 'string') {
      parts.push(msg)
      continue
    }

    if (msg === null || msg === undefined || typeof msg !== 'object') {
      continue
    }

    const message = msg as MessageLike

    if (typeof message.content === 'string') {
      parts.push(message.content)
      continue
    }

    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (
          part !== null
          && typeof part === 'object'
          && 'type' in part
          && (part as MessageContent).type === 'text'
          && typeof (part as MessageContent).text === 'string'
        ) {
          parts.push((part as MessageContent).text!)
        }
      }
    }
  }

  return parts.join(' ')
}

export function createSafetyGuard(config: SafetyConfig) {
  return {
    check(request: ArmorRequest, ctx: ArmorContext): SafetyCheckResult {
      const details: string[] = []
      const messages = request.messages ?? []
      const fullText = extractText(messages)

      // Check max tokens per request
      if (config.maxTokensPerRequest != null) {
        const tokens = encode(fullText)
        if (tokens.length > config.maxTokensPerRequest) {
          details.push(
            `Token count ${tokens.length} exceeds limit ${config.maxTokensPerRequest}`,
          )
        }
      }

      // Check prompt injection
      if (config.promptInjection) {
        const result = checkInjection(fullText)
        if (result.detected) {
          details.push(`Prompt injection detected: ${result.pattern}`)
        }
      }

      // Check PII
      if (config.piiDetection) {
        const result = checkPII(fullText)
        if (result.detected) {
          details.push(`PII detected: ${result.types.join(', ')}`)
        }
      }

      // Check blocked patterns
      if (config.blockedPatterns) {
        for (const pattern of config.blockedPatterns) {
          // Reset lastIndex to avoid non-deterministic behavior with stateful RegExp (g/y flags)
          pattern.lastIndex = 0
          if (pattern.test(fullText)) {
            details.push(`Blocked pattern matched: ${pattern.source}`)
          }
        }
      }

      const blocked = details.length > 0
      const reason = blocked ? details.join('; ') : null

      if (blocked && config.onBlocked) {
        config.onBlocked(ctx, reason!)
      }

      return {
        allowed: !blocked,
        blocked,
        reason,
        details,
      }
    },
  }
}
