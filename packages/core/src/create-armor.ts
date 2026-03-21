import type { ArmorConfig, ArmorContext, ArmorInstance, ArmorLog } from './types'

export function createArmor(config: ArmorConfig): ArmorInstance {
  return {
    config,

    async checkRateLimit(_ctx: ArmorContext): Promise<boolean> {
      // TODO: implement rate limiting
      return true
    },

    async trackCost(_log: ArmorLog): Promise<void> {
      // TODO: implement cost tracking
    },

    resolveModel(model: string): string {
      if (config.routing?.aliases) {
        return config.routing.aliases[model] ?? model
      }
      return model
    },
  }
}
