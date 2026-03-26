# ai-armor

## 0.1.7

### Patch Changes

- [#18](https://github.com/billymaulana/ai-armor/pull/18) [`bef6d27`](https://github.com/billymaulana/ai-armor/commit/bef6d27f1dd5854bb44372330cb12ee4539dc903) Thanks [@billymaulana](https://github.com/billymaulana)! - fix: comprehensive review fixes

  - fix redis entry point missing type declarations
  - fix semantic cache embedding errors crashing responses (graceful degradation)
  - fix input length cap to prevent DoS via tokenization
  - fix budget check making 3-4 sequential store reads (now single pass)
  - fix rate limit resetAt accuracy on allowed path
  - fix sliding window parseWindow re-parsed per request (now precomputed)
  - fix checkBudget action type from string to discriminated union
  - fix Nuxt safety endpoint missing input length validation (413)
  - fix Nuxt status endpoint always returning healthy: true
  - fix Nuxt rate-limit middleware applying to \_armor routes
  - fix Nuxt module missing RuntimeConfig type augmentation
  - register initArmor/useArmorInstance as server auto-imports
  - move @nuxt/schema to devDependencies
  - raise coverage thresholds to 99%
  - add CI concurrency, timeout, permissions

## 0.1.6

### Patch Changes

- fix(nuxt): explicit h3 imports for all server runtime files

## 0.1.5

### Patch Changes

- fix(nuxt): use workspace:^ for proper version resolution on publish

## 0.1.4

### Patch Changes

- fix(nuxt): resolve workspace protocol for npm publish

## 0.1.3

### Patch Changes

- fix(nuxt): add explicit import for defineNitroPlugin in server plugin

## 0.1.2

### Patch Changes

- [`80208a0`](https://github.com/billymaulana/ai-armor/commit/80208a04cadad9ef24555621411c8adc0cfd98e2) Thanks [@billymaulana](https://github.com/billymaulana)! - Sync API docs with source code, fix logo transparency, improve test coverage to 99.6%

## 0.1.1

### Patch Changes

- [#1](https://github.com/billymaulana/ai-armor/pull/1) [`46d844a`](https://github.com/billymaulana/ai-armor/commit/46d844aca9915da2c14877db6ba57b6ee5ca4fc7) Thanks [@billymaulana](https://github.com/billymaulana)! - Fix production-critical bugs: status endpoint no longer consumes rate limit tokens (peekRateLimit), usage endpoint reads from CostTracker instead of volatile log buffer, wrapStream flush error cannot corrupt stream delivery, initArmor warns on double-init, and non-serializable config keys are reported at build time.
