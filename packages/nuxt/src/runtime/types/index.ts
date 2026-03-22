export interface ArmorUsageResponse {
  todayCost: number
  monthCost: number
  budget: { daily: number, monthly: number }
  costHistory: Array<{ date: string, cost: number }>
}

export interface ArmorStatusResponse {
  healthy: boolean
  rateLimitRemaining: number
  rateLimitResetAt: string | null
}
