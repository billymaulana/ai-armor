/**
 * Post-build script: generate stable .d.ts entry files.
 *
 * tsdown produces hashed declaration chunk names (e.g. index-B5cczaT1.d.ts).
 * This script creates stable proxy files (index.d.ts) that re-export from
 * the hashed chunks, so package.json exports resolve correctly.
 */
import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const dist = join(import.meta.dirname, '..', 'dist')
const entries = ['index', 'ai-sdk', 'http']

const files = readdirSync(dist)

for (const entry of entries) {
  // ESM declaration: entry-HASH.d.ts -> entry.d.ts
  const dtsMatches = files.filter(f => f.startsWith(`${entry}-`) && f.endsWith('.d.ts') && !f.endsWith('.d.cts'))
  if (dtsMatches.length > 1) {
    process.stderr.write(`[fix-dts] Ambiguous: multiple .d.ts matches for ${entry}: ${dtsMatches.join(', ')}\n`)
    process.exit(1)
  }
  if (dtsMatches[0]) {
    const moduleName = dtsMatches[0].replace('.d.ts', '')
    writeFileSync(join(dist, `${entry}.d.ts`), `export * from './${moduleName}'\n`)
  }

  // CJS declaration: entry-HASH.d.cts -> entry.d.cts
  const dctsMatches = files.filter(f => f.startsWith(`${entry}-`) && f.endsWith('.d.cts'))
  if (dctsMatches.length > 1) {
    process.stderr.write(`[fix-dts] Ambiguous: multiple .d.cts matches for ${entry}: ${dctsMatches.join(', ')}\n`)
    process.exit(1)
  }
  if (dctsMatches[0]) {
    const moduleName = dctsMatches[0].replace('.d.cts', '')
    writeFileSync(join(dist, `${entry}.d.cts`), `export * from './${moduleName}'\n`)
  }
}
