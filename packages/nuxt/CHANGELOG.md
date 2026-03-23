# @ai-armor/nuxt

## 0.1.1

### Patch Changes

- [#1](https://github.com/billymaulana/ai-armor/pull/1) [`46d844a`](https://github.com/billymaulana/ai-armor/commit/46d844aca9915da2c14877db6ba57b6ee5ca4fc7) Thanks [@billymaulana](https://github.com/billymaulana)! - Fix production-critical bugs: status endpoint no longer consumes rate limit tokens (peekRateLimit), usage endpoint reads from CostTracker instead of volatile log buffer, wrapStream flush error cannot corrupt stream delivery, initArmor warns on double-init, and non-serializable config keys are reported at build time.

- Updated dependencies [[`46d844a`](https://github.com/billymaulana/ai-armor/commit/46d844aca9915da2c14877db6ba57b6ee5ca4fc7)]:
  - ai-armor@0.1.1
