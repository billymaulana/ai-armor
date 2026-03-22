export const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?prior\s+instructions/i,
  /ignore\s+(all\s+)?above\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|rules|guidelines)/i,
  /forget\s+(all\s+)?your\s+(instructions|rules|guidelines|programming)/i,
  /override\s+(all\s+)?(previous|prior|your)\s+(instructions|rules|directives)/i,
  /system\s*prompt/i,
  /reveal\s+(your|the)\s+(system|initial|original)\s+(prompt|instructions|message)/i,
  /jailbreak/i,
  /\bDAN\b/,
  /do\s+anything\s+now/i,
  /pretend\s+(you\s+are|to\s+be|you're)/i,
  /act\s+as\s+if\s+(you|there)/i,
  /you\s+are\s+now\s+(a|an|in)\b/i,
  /bypass\s+(your|all|the|any)\s+(restrictions|filters|safety|guidelines|rules)/i,
  /new\s+instructions\s*:/i,
  /\[system\]/i,
  /<\|im_start\|>/i,
]

export interface PiiPatterns {
  [key: string]: RegExp
}

export const PII_PATTERNS: PiiPatterns = {
  email: /[\w.%+-]+@[\w.-]+\.[a-z]{2,}/i,
  phone: /(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}/,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/,
  creditCard: /\b(?:\d{4}[ -]?){3}\d{1,4}\b/,
}

export interface InjectionResult {
  detected: boolean
  pattern: string | null
}

export interface PiiResult {
  detected: boolean
  types: string[]
}

export function checkInjection(text: string): InjectionResult {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return { detected: true, pattern: pattern.source }
    }
  }
  return { detected: false, pattern: null }
}

export function checkPII(text: string): PiiResult {
  const types: string[] = []

  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    if (pattern.test(text)) {
      types.push(type)
    }
  }

  return { detected: types.length > 0, types }
}
