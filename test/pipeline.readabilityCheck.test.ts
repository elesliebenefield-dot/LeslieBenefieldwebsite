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

function makeCapture(minVisibleFontSizePx: number | null): RawCapture<'readability'> {
  return {
    envelopeSchemaVersion: RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION,
    checkId: 'readability',
    payloadSchemaVersion: '1.0.0',
    provenance: { capturedAt: '2026-01-01T00:00:00.000Z', viewport: { name: 'mobile', width: 390, height: 844 }, finalUrl: 'https://fixture.invalid/' },
    payload: { __brand: 'ReadabilityCapturePayload', minVisibleFontSizePx },
    incompleteCoverage: {},
  }
}

function runReadability(minVisibleFontSizePx: number | null) {
  const capture = makeCapture(minVisibleFontSizePx)
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
