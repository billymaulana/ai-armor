# Safety Guardrails

ai-armor provides request-level safety checks to protect your AI endpoints from prompt injection, PII leakage, excessive token usage, and blocked content patterns.

## Configuration

```ts
import { createArmor } from 'ai-armor'

const armor = createArmor({
  safety: {
    promptInjection: true,
    piiDetection: true,
    maxTokensPerRequest: 4096,
    blockedPatterns: [
      /ignore previous instructions/i,
      /system:\s*you are now/i,
    ],
    onBlocked: (ctx, reason) => {
      console.warn(`[safety] Blocked request from ${ctx.userId}: ${reason}`)
    },
  },
})
```

## SafetyConfig Options

| Field | Type | Default | Description |
|---|---|---|---|
| `promptInjection` | `boolean` | `false` | Enable prompt injection detection |
| `piiDetection` | `boolean` | `false` | Enable PII (personally identifiable information) detection |
| `maxTokensPerRequest` | `number` | -- | Maximum tokens allowed per request |
| `blockedPatterns` | `RegExp[]` | `[]` | Regular expressions that block matching content |
| `onBlocked` | `function` | -- | Callback fired when a request is blocked |

## Prompt Injection Detection

When `promptInjection: true`, ai-armor scans incoming messages for common injection patterns:

```ts
const armor = createArmor({
  safety: {
    promptInjection: true,
    onBlocked: (ctx, reason) => {
      console.warn(`Blocked: ${reason}`)
      // Log to security monitoring
    },
  },
})
```

Common patterns detected include:

- Attempts to override system prompts ("ignore previous instructions")
- Role-switching attacks ("you are now a different AI")
- Delimiter-based injection (attempting to close system message blocks)

::: tip Defense in Depth
Prompt injection detection is a heuristic layer -- it catches common patterns but is not foolproof. Always combine it with:
- Strong system prompts that reinforce boundaries
- Output validation for sensitive operations
- Rate limiting to slow down automated attacks
:::

## PII Detection

When `piiDetection: true`, ai-armor scans for patterns that look like personally identifiable information:

```ts
const armor = createArmor({
  safety: {
    piiDetection: true,
    onBlocked: (ctx, reason) => {
      // reason: 'PII detected in request'
      audit.log('pii_blocked', { userId: ctx.userId })
    },
  },
})
```

PII patterns include:

- Email addresses
- Phone numbers
- Social Security Numbers (SSN format)
- Credit card numbers
- IP addresses in message content

::: warning
PII detection uses pattern matching and may produce false positives (e.g., example email addresses in educational content). Review your use case and adjust accordingly.
:::

## maxTokensPerRequest

Set a hard limit on the number of tokens per request to prevent runaway costs from excessively long prompts:

```ts
const armor = createArmor({
  safety: {
    maxTokensPerRequest: 4096,
    onBlocked: (ctx, reason) => {
      // reason: 'Request exceeds max tokens: 4096'
    },
  },
})
```

This is checked before the request is sent to the AI provider, saving you money on rejected requests.

## Blocked Patterns

Define custom regular expressions to block specific content:

```ts
const armor = createArmor({
  safety: {
    blockedPatterns: [
      // Block attempts to override instructions
      /ignore previous instructions/i,
      /disregard all prior/i,
      /system:\s*you are now/i,

      // Block specific topics
      /generate.*malware/i,
      /create.*exploit/i,

      // Block competitor mentions (business rule)
      /\b(competitor-name)\b/i,
    ],
    onBlocked: (ctx, reason) => {
      console.warn(`Blocked pattern match from ${ctx.userId}: ${reason}`)
    },
  },
})
```

Patterns are tested against all message content in the request. If any pattern matches, the request is blocked.

## onBlocked Callback

The `onBlocked` callback fires whenever a safety check blocks a request:

```ts
const armor = createArmor({
  safety: {
    promptInjection: true,
    piiDetection: true,
    blockedPatterns: [/hack/i],
    onBlocked: (ctx, reason) => {
      // ctx: the ArmorContext for the request
      // reason: human-readable description of why it was blocked

      // Log for security audit
      securityLog.warn({
        event: 'ai_request_blocked',
        userId: ctx.userId,
        ip: ctx.ip,
        reason,
        timestamp: Date.now(),
      })

      // Increment security metrics
      metrics.increment('ai.safety.blocked', { reason })

      // Alert on repeated blocks from same user
      const recentBlocks = getRecentBlocks(ctx.userId)
      if (recentBlocks > 5) {
        alertSecurityTeam(`User ${ctx.userId} has been blocked ${recentBlocks} times`)
      }
    },
  },
})
```

## Combining Safety with Other Features

Safety checks work alongside all other ai-armor features:

```ts
const armor = createArmor({
  // Rate limiting catches automated attacks
  rateLimit: {
    strategy: 'sliding-window',
    rules: [{ key: 'user', limit: 30, window: '1m' }],
  },

  // Safety catches malicious content
  safety: {
    promptInjection: true,
    piiDetection: true,
    maxTokensPerRequest: 8192,
    blockedPatterns: [/ignore previous/i],
    onBlocked: (ctx, reason) => {
      console.warn(`[safety] ${ctx.userId}: ${reason}`)
    },
  },

  // Logging records blocked requests
  logging: {
    enabled: true,
    include: ['model', 'userId', 'cost'],
    onRequest: async (log) => {
      if (log.blocked) {
        // Log blocked requests separately
        await securityAudit.record(log)
      }
    },
  },

  // Budget limits damage from any requests that get through
  budget: {
    daily: 100,
    perUser: 10,
    onExceeded: 'block',
  },
})
```

## Typical Request Flow

When safety is enabled, the request evaluation order is:

1. **Rate limit check** -- Is the user within rate limits?
2. **Safety check** -- Does the content pass all safety rules?
3. **Budget check** -- Is there budget remaining?
4. **Cache check** -- Is there a cached response?
5. **API call** -- Forward to the AI provider

If any check fails, the request is rejected before reaching subsequent checks.

## Related

- [Rate Limiting](/guide/rate-limiting) -- Complements safety with request throttling
- [Cost Tracking](/guide/cost-tracking) -- Budget limits as a financial safety net
- [Logging](/guide/logging) -- Audit blocked requests
- [API Reference: Types](/api/types) -- SafetyConfig interface
