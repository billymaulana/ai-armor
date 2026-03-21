import type { RoutingConfig } from '../types'

export function createModelResolver(config: RoutingConfig) {
  const aliases = new Map(Object.entries(config.aliases))

  function resolve(model: string): string {
    return aliases.get(model) ?? model
  }

  function addAlias(alias: string, model: string): void {
    aliases.set(alias, model)
  }

  function removeAlias(alias: string): void {
    aliases.delete(alias)
  }

  function getAliases(): Record<string, string> {
    return Object.fromEntries(aliases)
  }

  return {
    resolve,
    addAlias,
    removeAlias,
    getAliases,
  }
}
