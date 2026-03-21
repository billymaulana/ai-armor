# Contributing to ai-armor

Thanks for your interest in contributing!

## Development Setup

```bash
# Clone the repo
git clone https://github.com/billymaulana/ai-armor.git
cd ai-armor

# Install dependencies
pnpm install

# Run tests
pnpm test

# Run linter
pnpm lint

# Type check
pnpm typecheck

# Build all packages
pnpm build
```

## Project Structure

```
packages/
  core/     # ai-armor - framework-agnostic core
  nuxt/     # @ai-armor/nuxt - Nuxt module
docs/       # VitePress documentation
playground/ # Example scripts
```

## Development Workflow

1. Create a branch from `main`: `git checkout -b feat/your-feature`
2. Make your changes
3. Run quality checks: `pnpm quality`
4. Add a changeset: `pnpm changeset`
5. Create a pull request

## Code Standards

- TypeScript strict mode -- zero `any`
- ESLint with @antfu/eslint-config -- no Prettier
- Named exports only (no default exports)
- `interface` over `type` for object shapes
- No `console.log` -- use logging hooks
- Tests required for all new features (>= 80% coverage)

## PR Checklist

- [ ] Tests added/updated
- [ ] TypeScript strict mode passes
- [ ] ESLint passes (zero warnings)
- [ ] Changeset added (if user-facing)
- [ ] No `console.log` or `any` types
- [ ] Docs updated (if API change)

## Testing

All tests use mock providers -- zero real API calls. Use `createMockProvider()` from test fixtures.

```bash
pnpm test              # run tests
pnpm test:coverage     # run with coverage
```

## Questions?

Open a [Discussion](https://github.com/billymaulana/ai-armor/discussions) for questions or ideas.
