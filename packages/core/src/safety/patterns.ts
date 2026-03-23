export const INJECTION_PATTERNS: RegExp[] = [
  // -- Instruction override attempts --
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?prior\s+instructions/i,
  /ignore\s+(all\s+)?above\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|rules|guidelines)/i,
  /forget\s+(all\s+)?your\s+(instructions|rules|guidelines|programming)/i,
  /override\s+(all\s+)?(previous|prior|your)\s+(instructions|rules|directives)/i,
  /\bdo\s+not\s+(?:follow|obey)\s+(?:your|any|the)\s+(?:rules|instructions|guidelines)/i,
  /\breset\s+(?:your|all)\s+(?:instructions|rules|constraints|parameters)/i,

  // -- System prompt extraction --
  /system\s*prompt/i,
  /reveal\s+(your|the)\s+(system|initial|original)\s+(prompt|instructions|message)/i,
  /\bprint\s+(?:the\s+)?(?:above|previous|system|initial)\s+(?:prompt|instructions|message)/i,

  // -- Jailbreak / persona hijacking --
  /jailbreak/i,
  /\bDAN\b/,
  /do\s+anything\s+now/i,
  /pretend\s+(you\s+are|to\s+be|you're)/i,
  /act\s+as\s+if\s+(you|there)/i,
  /you\s+are\s+now\s+(a|an|in)\b/i,

  // -- Privilege escalation / mode switching --
  /\b(?:dev(?:eloper)?|god|sudo|admin)\s+mode\b/i,
  /\bunfiltered\s+(?:mode|response|output)/i,
  /\brespond\s+without\s+(?:any\s+)?(?:restrictions|filters|limitations|censorship)/i,
  /\bsuppress\s+(?:your|all|any)\s+(?:safety|content|output)\s+filter/i,

  // -- Restriction bypass --
  /bypass\s+(your|all|the|any)\s+(restrictions|filters|safety|guidelines|rules)/i,

  // -- Prompt format injection (model-specific markers) --
  /new\s+instructions\s*:/i,
  /\[system\]/i,
  /<\|im_start\|>/i,
  /<<\s*SYS\s*>>/,
]

export interface PiiPatterns {
  [key: string]: RegExp
}

export const PII_PATTERNS: PiiPatterns = {
  email: /[\w.%+-]+@[\w.-]+\.[a-z]{2,}/i,
  phone: /(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}/,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/,
  creditCard: /\b(?:\d{4}[ -]?){3}\d{1,4}\b/,
  // International formats
  iban: /\b[A-Z]{2}\d{2}\s?[A-Z0-9]{4}(?:\s?[A-Z0-9]{4}){1,7}(?:\s?[A-Z0-9]{1,4})?\b/,
  intlPhone: /\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{2,4}[-.\s]?\d{2,4}(?:[-.\s]?\d{1,4})?/,
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
