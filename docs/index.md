---
layout: home

features:
  - icon:
      src: /icons/rate-limit.svg
      alt: Rate Limiting
    title: Rate Limiting
    details: Sliding-window rate limiter with per-user, per-IP, and per-key rules. Shared state across instances via Redis.
    link: /guide/rate-limiting
  - icon:
      src: /icons/cost.svg
      alt: Cost Tracking
    title: Cost Tracking
    details: Real-time cost tracking with 70+ model pricing database. Daily, monthly, and per-user budgets with auto-downgrade.
    link: /guide/cost-tracking
  - icon:
      src: /icons/cache.svg
      alt: Response Caching
    title: Response Caching
    details: O(1) LRU cache with exact-match strategy. Skip redundant API calls. Custom key functions for control.
    link: /guide/caching
  - icon:
      src: /icons/routing.svg
      alt: Model Routing
    title: Model Routing
    details: Alias models by tier (fast/balanced/best) and resolve at runtime. Switch providers without changing application code.
    link: /guide/model-routing
  - icon:
      src: /icons/safety.svg
      alt: Safety Guardrails
    title: Safety Guardrails
    details: Block prompt injection, detect PII, enforce token limits, and filter with custom patterns. Fail closed.
    link: /guide/safety
  - icon:
      src: /icons/logging.svg
      alt: Logging
    title: Logging & Observability
    details: Structured logs for every request with cost, latency, tokens, and cache status. Stream to any analytics backend.
    link: /guide/logging
  - icon:
      src: /icons/providers.svg
      alt: Providers
    title: 18+ AI Providers
    details: OpenAI, Anthropic, Google, Mistral, Cohere, DeepSeek, Groq, Together AI, Fireworks, Perplexity, AWS Bedrock, Azure, and more.
    link: /examples/providers
  - icon:
      src: /icons/unlock.svg
      alt: Zero Lock-in
    title: Zero Lock-in
    details: Framework-agnostic core. First-class Vercel AI SDK middleware, Express/Hono/Fastify handlers, and Nuxt module.
    link: /integrations/ai-sdk
---
