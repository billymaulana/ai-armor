---
"ai-armor": patch
"@ai-armor/nuxt": patch
---

fix: comprehensive review fixes

- fix redis entry point missing type declarations
- fix semantic cache embedding errors crashing responses (graceful degradation)
- fix input length cap to prevent DoS via tokenization
- fix budget check making 3-4 sequential store reads (now single pass)
- fix rate limit resetAt accuracy on allowed path
- fix sliding window parseWindow re-parsed per request (now precomputed)
- fix checkBudget action type from string to discriminated union
- fix Nuxt safety endpoint missing input length validation (413)
- fix Nuxt status endpoint always returning healthy: true
- fix Nuxt rate-limit middleware applying to _armor routes
- fix Nuxt module missing RuntimeConfig type augmentation
- register initArmor/useArmorInstance as server auto-imports
- move @nuxt/schema to devDependencies
- raise coverage thresholds to 99%
- add CI concurrency, timeout, permissions
