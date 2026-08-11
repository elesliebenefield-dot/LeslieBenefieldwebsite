// Pure unit tests for mergeFallbackIntoResult (src/lib/technicalFallbackMerge.ts)
// — proves completed-check count and score update correctly when a
// contact/links rendered-DOM fallback resolves, using the exact same
// renormalization formula api/check-website.ts's buildReport uses. No
// browser, no network.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeFallbackIntoResult } from '../src/lib/technicalFallbackMerge.ts'
import type { CheckSuccess } from '../src/lib/websiteCheck.ts'
import type { TechnicalFallbackResult } from '../src/lib/visualCheck.ts'

function baseResult(): CheckSuccess {
  return {
    ok: true,
    input: 'example.com',
    finalUrl: 'https://example.com/',
    score: 79, // round((66/83)*100) — availability+https+mobile+title+meta = 30+25+15+10+5-ish, both contact/links unverified
    rawScore: 66,
    possiblePoints: 83,
    summary: 'The technical basics checked look solid, with some room to improve.',
    findings: [
      { id: 'availability', label: 'Homepage availability', bucket: 'good', detail: 'Your homepage loaded successfully.' },
      { id: 'contact', label: 'Contact information', bucket: 'unverified', detail: 'This website loads some content through browser scripts, so this automated check could not verify contact information. That does not necessarily mean anything is wrong.' },
      { id: 'links', label: 'Homepage links', bucket: 'unverified', detail: 'This website loads some content through browser scripts, so this automated check could not find enough links to sample. That does not necessarily mean anything is wrong.' },
    ],
    checksCompleted: 5,
    checksTotal: 7,
  }
}

const goodContact: TechnicalFallbackResult = {
  finding: { id: 'contact', label: 'Contact information', bucket: 'good', detail: 'We found what appears to be contact information (a phone number, email address, or contact link) on your homepage.' },
  points: 5,
  possiblePointsRestored: 5,
}

const goodLinks: TechnicalFallbackResult = {
  finding: { id: 'links', label: 'Homepage links', bucket: 'good', detail: 'We checked a sample of 3 links from your homepage and all of them loaded fine. This is a sample, not a full site crawl.' },
  points: 5,
  possiblePointsRestored: 5,
}

test('no fallback supplied: the result is returned unchanged (same reference)', () => {
  const result = baseResult()
  assert.equal(mergeFallbackIntoResult(result), result)
})

test('a resolved contact fallback replaces the unverified finding and increments checksCompleted by 1', () => {
  const merged = mergeFallbackIntoResult(baseResult(), goodContact, undefined)
  const contact = merged.findings.find((f) => f.id === 'contact')
  assert.equal(contact?.bucket, 'good')
  assert.equal(merged.checksCompleted, 6)
  assert.equal(merged.rawScore, 66 + 5)
  assert.equal(merged.possiblePoints, 83 + 5)
  assert.equal(merged.score, Math.round(((66 + 5) / (83 + 5)) * 100))
})

test('a resolved links fallback replaces the unverified finding and increments checksCompleted by 1', () => {
  const merged = mergeFallbackIntoResult(baseResult(), undefined, goodLinks)
  const links = merged.findings.find((f) => f.id === 'links')
  assert.equal(links?.bucket, 'good')
  assert.equal(merged.checksCompleted, 6)
  assert.equal(merged.rawScore, 66 + 5)
  assert.equal(merged.possiblePoints, 83 + 5)
})

test('both contact and links resolving at once: checksCompleted increments by 2, score renormalizes against both restored points', () => {
  const merged = mergeFallbackIntoResult(baseResult(), goodContact, goodLinks)
  assert.equal(merged.checksCompleted, 7)
  assert.equal(merged.rawScore, 66 + 5 + 5)
  assert.equal(merged.possiblePoints, 83 + 5 + 5)
  assert.equal(merged.score, Math.round(((66 + 10) / (83 + 10)) * 100))
  assert.equal(merged.findings.find((f) => f.id === 'contact')?.bucket, 'good')
  assert.equal(merged.findings.find((f) => f.id === 'links')?.bucket, 'good')
})

test('a fallback whose finding is "improve" (genuinely no contact found, even rendered) still resolves the check without a fabricated pass', () => {
  const improveContact: TechnicalFallbackResult = {
    finding: { id: 'contact', label: 'Contact information', bucket: 'improve', detail: 'We couldn’t clearly find contact information on your homepage. Visible contact details help build trust with visitors.' },
    points: 0,
    possiblePointsRestored: 5,
  }
  const merged = mergeFallbackIntoResult(baseResult(), improveContact, undefined)
  assert.equal(merged.findings.find((f) => f.id === 'contact')?.bucket, 'improve')
  assert.equal(merged.checksCompleted, 6, 'the check is still resolved (no longer unverified), even though it did not pass')
  assert.equal(merged.rawScore, 66, 'no points added for an "improve" outcome')
  assert.equal(merged.possiblePoints, 88, 'possiblePoints is still restored — the check was genuinely evaluated')
})

test('defensive guard: a fallback is ignored if the matching finding is no longer "unverified" (already resolved) — never double-counted', () => {
  const result = baseResult()
  const alreadyResolved: CheckSuccess = {
    ...result,
    findings: result.findings.map((f) => (f.id === 'contact' ? { ...f, bucket: 'good' as const } : f)),
  }
  const merged = mergeFallbackIntoResult(alreadyResolved, goodContact, undefined)
  assert.equal(merged.checksCompleted, alreadyResolved.checksCompleted, 'must not double-increment an already-resolved check')
  assert.equal(merged.rawScore, alreadyResolved.rawScore, 'must not double-add points for an already-resolved check')
})
