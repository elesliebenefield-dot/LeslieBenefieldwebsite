// Test-only module resolution hook. Production source files use `.js`
// specifiers on relative imports (e.g. `from './visualCheck.js'`) so that
// Vercel's Node runtime can resolve them at deploy time — TypeScript treats
// that specifier as pointing at the sibling `.ts` source during type-checking,
// but plain `node --test` has no such remapping and fails with
// ERR_MODULE_NOT_FOUND. This hook adds exactly that one remapping — only for
// this test run, never for the deployed code — so multi-file modules like
// visualScoring.ts can be imported directly without a build step.

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('.js') && (specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    const candidateURL = new URL(specifier, context.parentURL)
    if (!existsSync(fileURLToPath(candidateURL))) {
      const tsSpecifier = specifier.slice(0, -3) + '.ts'
      const tsURL = new URL(tsSpecifier, context.parentURL)
      if (existsSync(fileURLToPath(tsURL))) {
        return nextResolve(tsSpecifier, context)
      }
    }
  }
  return nextResolve(specifier, context)
}
