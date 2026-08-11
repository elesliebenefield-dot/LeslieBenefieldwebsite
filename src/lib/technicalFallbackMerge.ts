// Splices a resolved 'contact'/'links' rendered-DOM fallback (see
// api/check-visual.ts, src/lib/contactLinksCheck.ts) into an
// already-displayed Technical Basics result. Extracted from
// CheckPage.tsx (a .tsx file, not importable by the plain Node test
// loader) so this is directly testable — see
// test/technicalFallbackMerge.test.ts.

import type { CheckSuccess } from './websiteCheck.js'
import type { TechnicalFallbackResult } from './visualCheck.js'

/**
 * Only replaces a finding that's still 'unverified' (defensive — the
 * server only returns a fallback for a check that was actually
 * requested as unverified, so this is normally a no-op guard, not a
 * real branch). Score is renormalized with the exact same formula
 * api/check-website.ts's own buildReport uses
 * (`round((rawScore / possiblePoints) * 100)`, clamped 0-100) — nothing
 * about WHAT counts as a pass or how many points a check is worth is
 * ever re-decided here, only that one stable formula reapplied to
 * updated numbers the server already computed.
 */
export function mergeFallbackIntoResult(result: CheckSuccess, contactFallback?: TechnicalFallbackResult, linksFallback?: TechnicalFallbackResult): CheckSuccess {
  if (!contactFallback && !linksFallback) return result

  // The SAME "was this check actually still unverified" condition gates
  // both the finding replacement AND every numeric update below — a
  // fallback object being present is not enough on its own (a stale/
  // duplicate response must never double-count points or checksCompleted
  // for a check that's already resolved).
  const applyContact = !!contactFallback && result.findings.some((f) => f.id === 'contact' && f.bucket === 'unverified')
  const applyLinks = !!linksFallback && result.findings.some((f) => f.id === 'links' && f.bucket === 'unverified')
  if (!applyContact && !applyLinks) return result

  const findings = result.findings.map((f) => {
    if (applyContact && f.id === 'contact') return contactFallback!.finding
    if (applyLinks && f.id === 'links') return linksFallback!.finding
    return f
  })

  const rawScore = result.rawScore + (applyContact ? contactFallback!.points : 0) + (applyLinks ? linksFallback!.points : 0)
  const possiblePoints = result.possiblePoints + (applyContact ? contactFallback!.possiblePointsRestored : 0) + (applyLinks ? linksFallback!.possiblePointsRestored : 0)
  const score = possiblePoints > 0 ? Math.max(0, Math.min(100, Math.round((rawScore / possiblePoints) * 100))) : result.score
  const checksCompleted = result.checksCompleted + (applyContact ? 1 : 0) + (applyLinks ? 1 : 0)

  return { ...result, findings, rawScore, possiblePoints, score, checksCompleted }
}
