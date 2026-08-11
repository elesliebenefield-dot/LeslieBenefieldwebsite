// Release-polish fix: the prefilled "Email My Results to Leslie" body
// used to always claim the visual review "did not complete" — the
// caller always passed `null`, a leftover from when the public visual
// route was withdrawn. Pure unit tests, no browser: buildCombinedEmailBody/
// buildMailtoHref take a plain CheckSuccess + RebuildCheckSuccess|null.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCombinedEmailBody, buildMailtoHref } from '../src/lib/emailBody.ts'
import type { CheckSuccess } from '../src/lib/websiteCheck.ts'
import type { RebuildCheckSuccess } from '../src/lib/visualCheck.ts'

function technical(): CheckSuccess {
  return {
    ok: true,
    status: 'scored',
    input: 'example.com',
    finalUrl: 'https://example.com/',
    score: 90,
    rawScore: 90,
    possiblePoints: 100,
    summary: 'The technical basics checked look great, with just a few small things worth a look.',
    findings: [{ id: 'https', label: 'Secure connection', bucket: 'good', detail: 'Uses HTTPS.', points: 25 }],
    checksCompleted: 7,
    checksTotal: 7,
  }
}

const DEFAULT_TIER = { detailLimit: null, includeGoodSections: true, unverifiedSummaryOnly: false }

test('a successful visual review: the email says it completed and lists the actual findings, never "did not complete"', () => {
  const visual: RebuildCheckSuccess = {
    ok: true,
    status: 'complete',
    finalUrl: 'https://example.com/',
    findings: [
      { checkId: 'overflow', label: 'No clear issue found', detail: 'The page content fits within the 390px mobile viewport.' },
      { checkId: 'readability', label: 'Worth a manual look', detail: 'The smallest visible text found on the page is 12px — on the small side.' },
    ],
  }
  const body = buildCombinedEmailBody(technical(), visual, DEFAULT_TIER)

  assert.ok(body.includes('Technical Basics Score: 90/100 (7 of 7 checks completed)'), 'a scored result must show its real score in the email')
  assert.ok(!body.includes('did not complete'), 'must not claim the visual review did not complete when it succeeded')
  assert.ok(body.includes('Visual & Usability Review: completed'))
  assert.ok(body.includes('Visual & Usability Review:'), 'must include a dedicated section header for the findings')
  assert.ok(body.includes('Mobile horizontal scrolling'), 'must include the overflow finding by its check name')
  assert.ok(body.includes('No clear issue found'))
  assert.ok(body.includes('The page content fits within the 390px mobile viewport.'))
  assert.ok(body.includes('Text readability'), 'must include the readability finding by its check name')
  assert.ok(body.includes('Worth a manual look'))
  assert.ok(body.includes('12px — on the small side'))
})

test('a failed/unavailable visual review (visual === null): the email uses the unavailable wording and lists no findings section', () => {
  const body = buildCombinedEmailBody(technical(), null, DEFAULT_TIER)

  assert.ok(body.includes('Visual & Usability Review: not available (the visual review did not complete)'))
  assert.ok(!body.includes('Mobile horizontal scrolling'), 'must not fabricate visual findings when the review never completed')
  assert.ok(!body.includes('Text readability'))
})

test('buildMailtoHref: a successful visual review produces a valid mailto: URL containing the encoded findings', () => {
  const visual: RebuildCheckSuccess = {
    ok: true,
    status: 'complete',
    finalUrl: 'https://example.com/',
    findings: [{ checkId: 'overflow', label: 'Likely opportunity', detail: 'Clear horizontal overflow on mobile.' }],
  }
  const href = buildMailtoHref(technical(), visual)
  assert.match(href, /^mailto:websitesbyleslie01@gmail\.com\?subject=/)
  const decoded = decodeURIComponent(href)
  assert.ok(decoded.includes('Visual & Usability Review: completed'))
  assert.ok(decoded.includes('Likely opportunity'))
})

test('buildMailtoHref: a failed visual review produces a valid mailto: URL with the unavailable wording', () => {
  const href = buildMailtoHref(technical(), null)
  const decoded = decodeURIComponent(href)
  assert.ok(decoded.includes('Visual & Usability Review: not available (the visual review did not complete)'))
})
