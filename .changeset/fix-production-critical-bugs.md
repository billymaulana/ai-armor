---
"ai-armor": patch
"@ai-armor/nuxt": patch
---

Fix production-critical bugs: status endpoint no longer consumes rate limit tokens (peekRateLimit), usage endpoint reads from CostTracker instead of volatile log buffer, wrapStream flush error cannot corrupt stream delivery, initArmor warns on double-init, and non-serializable config keys are reported at build time.
