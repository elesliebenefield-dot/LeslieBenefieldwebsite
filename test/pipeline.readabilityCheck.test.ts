// First real-checker release — pure, deterministic unit tests for the
// readability check's normalize/classify/present stages. No browser, no
// network: synthetic RawCapture objects only.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeReadabilityEvidence } from '../src/lib/pipeline/normalize/evidenceNormalizer.ts'
import { classifyReadability } from '../src/lib/pipeline/classify/classificationEngine.ts'
import { getReadabilityContract } from '../src/lib/pipeline/classify/contractRegistry.ts'
import { presentReadabilityFindings } from '../src/lib/pipeline/present/findingsPresenter.ts'
import { RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION, type RawCapture } from '../src/lib/pipeline/types/rawCapture.ts'

function makeCapture(minVisibleFontSizePx: number | null, footerMinVisibleFontSizePx: number | null = null): RawCapture<'readability'> {
  return {
    envelopeSchemaVersion: RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION,
    checkId: 'readability',
    payloadSchemaVersion: '1.0.0',
    provenance: { capturedAt: '2026-01-01T00:00:00.000Z', viewport: { name: 'mobile', width: 390, height: 844 }, finalUrl: 'https://fixture.invalid/' },
    payload: { __brand: 'ReadabilityCapturePayload', minVisibleFontSizePx, footerMinVisibleFontSizePx },
    incompleteCoverage: {},
  }
}

function runReadability(minVisibleFontSizePx: number | null, footerMinVisibleFontSizePx: number | null = null) {
  const capture = makeCapture(minVisibleFontSizePx, footerMinVisibleFontSizePx)
  const evidence = normalizeReadabilityEvidence(capture)
  const classification = classifyReadability({ evidence, contract: getReadabilityContract() })
  const findings = presentReadabilityFindings(classification)
  return { evidence, classification, findings }
}

// ─── positive: comfortable text size ────────────────────────────────

test('positive: 16px text is "good" / "No clear issue found"', () => {
  const { classification, findings } = runReadability(16)
  assert.equal(classification.outcome, 'good')
  assert.equal(findings[0].label, 'No clear issue found')
})

test('positive: exactly at the borderline threshold (14px) is already "good"', () => {
  const { classification } = runReadability(14)
  assert.equal(classification.outcome, 'good')
})

// ─── boundary: small but not confidently a problem ──────────────────

test('boundary: 12px text is "manual-review-advisory" / "Worth a manual look"', () => {
  const { classification, findings } = runReadability(12)
  assert.equal(classification.outcome, 'manual-review-advisory')
  assert.equal(findings[0].label, 'Worth a manual look')
})

test('boundary: exactly at the clear-issue threshold (11px) is already "manual-review-advisory"', () => {
  const { classification } = runReadability(11)
  assert.equal(classification.outcome, 'manual-review-advisory')
})

// ─── negative: clearly tiny text ────────────────────────────────────

test('negative: 9px text is "improve" / "Likely opportunity"', () => {
  const { classification, findings } = runReadability(9)
  assert.equal(classification.outcome, 'improve')
  assert.equal(findings[0].label, 'Likely opportunity')
})

// ─── honest uncertainty: nothing measurable ─────────────────────────

test('no visible text found: "unverified" / "Couldn\'t be checked" — never silently treated as a pass', () => {
  const { classification, findings } = runReadability(null)
  assert.equal(classification.outcome, 'unverified')
  assert.equal(findings[0].label, "Couldn't be checked")
  assert.notEqual(classification.outcome, 'good', 'must not fabricate a clean result when nothing could be measured')
})

// ─── honesty checks ──────────────────────────────────────────────────

test('readability findings never claim a score, WCAG compliance, or an automatic rejection', () => {
  const { classification, findings } = runReadability(9)
  const serialized = JSON.stringify({ classification, findings })
  for (const forbidden of ['score', 'reject', 'compliant']) {
    assert.ok(!serialized.toLowerCase().includes(forbidden), `must not contain "${forbidden}"`)
  }
  // "WCAG" itself is mentioned, but only to explicitly DISCLAIM it — the
  // classifier's own reasoning never says "WCAG compliant"/"compliance".
  assert.ok(!serialized.toLowerCase().includes('wcag-compliant'))
  assert.ok(!serialized.toLowerCase().includes('wcag compliance achieved'))
})

test('readability standardsBasis is product-policy and explicitly disclaims any WCAG citation', () => {
  const { classification } = runReadability(9)
  assert.equal(classification.standardsBasis.type, 'product-policy')
  if (classification.standardsBasis.type === 'product-policy') {
    assert.match(classification.standardsBasis.rationale, /no wcag-mandated/i)
  }
})

test('readability evidenceRefs is always empty — no audit trail is claimed for this release', () => {
  const { classification } = runReadability(9)
  assert.deepEqual(classification.evidenceRefs, [])
})

// ─── Release polish: displayed measurement is rounded, classification
// still uses the raw value ────────────────────────────────────────────

test('display: a fractional measurement is rounded to at most one decimal place — never a raw float like "10.6667px"', () => {
  const { classification } = runReadability(10.666666666666666)
  assert.match(classification.reasoning, /10\.7px/)
  assert.ok(!classification.reasoning.includes('10.6666'), 'must not display the raw unrounded float')
})

test('display: a fractional measurement that rounds to a whole number shows no decimal point — "11px", not "11.0px"', () => {
  const { classification } = runReadability(10.96)
  assert.match(classification.reasoning, /\b11px\b/)
  assert.ok(!classification.reasoning.includes('11.0px'))
})

test('classification threshold still uses the raw, unrounded measurement: 10.96px (which displays as "11px") is still "improve", not "good"', () => {
  const { classification } = runReadability(10.96)
  assert.equal(classification.outcome, 'improve', 'the unrounded value (10.96) is below the 11px clear-issue threshold, even though it displays rounded to "11px"')
})

// ─── Footer/utility context: never drives the outcome, only mentioned
// when it's genuinely smaller than the meaningful content, phrased
// conservatively when exceptionally tiny ────────────────────────────

test('footer context: a smaller footer/utility measurement does not change a "good" outcome, and is mentioned in the reasoning', () => {
  const { classification } = runReadability(14, 9.9)
  assert.equal(classification.outcome, 'good', 'the meaningful minimum (14px) drives the outcome, not the smaller footer text')
  assert.match(classification.reasoning, /14px/)
  assert.match(classification.reasoning, /9\.9px/)
  assert.match(classification.reasoning, /footer/i)
})

test('footer context: exceptionally tiny footer text (below the clear-issue threshold) is phrased as "worth a manual look", not a definite defect', () => {
  const { classification } = runReadability(16, 8)
  assert.equal(classification.outcome, 'good')
  assert.match(classification.reasoning, /worth a manual look/i)
})

test('footer context: footer text that is small but not exceptionally tiny is mentioned plainly, without "worth a manual look"', () => {
  const { classification } = runReadability(16, 12)
  assert.equal(classification.outcome, 'good')
  assert.match(classification.reasoning, /12px/)
  assert.ok(!classification.reasoning.toLowerCase().includes('worth a manual look'))
})

test('footer context: footer text that is not smaller than the meaningful minimum is not mentioned at all', () => {
  const { classification } = runReadability(12, 16)
  assert.equal(classification.outcome, 'manual-review-advisory')
  assert.ok(!classification.reasoning.toLowerCase().includes('footer'), 'footer text larger than the meaningful minimum is not noteworthy context')
})

test('footer context never turns an ordinary small footer measurement into "Likely opportunity" on its own — outcome tracks the meaningful minimum only', () => {
  const { classification: comfortable } = runReadability(16, 9.9)
  const { classification: tinyMeaningful } = runReadability(9, 9.9)
  assert.equal(comfortable.outcome, 'good')
  assert.equal(tinyMeaningful.outcome, 'improve', 'the SAME footer measurement (9.9px) must not itself be what drives "improve" — only the meaningful minimum does')
})

test('when NO meaningful text can be measured but footer/utility text exists, the result is a cautious "unverified" — not an unsupported "good" pass', () => {
  const { classification, findings } = runReadability(null, 10)
  assert.equal(classification.outcome, 'unverified')
  assert.equal(findings[0].label, "Couldn't be checked")
  assert.match(classification.reasoning, /10px/)
  assert.match(classification.reasoning, /footer/i)
})

test('when NO text at all could be measured (no footer either), the original honest message is unchanged', () => {
  const { classification } = runReadability(null, null)
  assert.equal(classification.outcome, 'unverified')
  assert.equal(classification.reasoning, 'We couldn’t find any visible text to measure on this page, so we couldn’t check text size.')
})
