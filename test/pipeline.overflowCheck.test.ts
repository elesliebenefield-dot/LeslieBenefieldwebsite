// First real-checker release — pure, deterministic unit tests for the
// overflow check's normalize/classify/present stages. No browser, no
// network: synthetic RawCapture objects only.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeOverflowEvidence } from '../src/lib/pipeline/normalize/evidenceNormalizer.ts'
import { classifyOverflow } from '../src/lib/pipeline/classify/classificationEngine.ts'
import { getOverflowContract } from '../src/lib/pipeline/classify/contractRegistry.ts'
import { presentOverflowFindings } from '../src/lib/pipeline/present/findingsPresenter.ts'
import { RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION, type RawCapture } from '../src/lib/pipeline/types/rawCapture.ts'

function makeCapture(viewportWidthPx: number, documentScrollWidthPx: number): RawCapture<'overflow'> {
  return {
    envelopeSchemaVersion: RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION,
    checkId: 'overflow',
    payloadSchemaVersion: '1.0.0',
    provenance: { capturedAt: '2026-01-01T00:00:00.000Z', viewport: { name: 'mobile', width: viewportWidthPx, height: 844 }, finalUrl: 'https://fixture.invalid/' },
    payload: { __brand: 'OverflowCapturePayload', viewportWidthPx, documentScrollWidthPx },
    incompleteCoverage: {},
  }
}

function runOverflow(viewportWidthPx: number, documentScrollWidthPx: number) {
  const capture = makeCapture(viewportWidthPx, documentScrollWidthPx)
  const evidence = normalizeOverflowEvidence(capture)
  const classification = classifyOverflow({ evidence, contract: getOverflowContract() })
  const findings = presentOverflowFindings(classification)
  return { evidence, classification, findings }
}

// ─── positive: no overflow ──────────────────────────────────────────

test('positive: content narrower than the viewport is "good" / "No clear issue found"', () => {
  const { evidence, classification, findings } = runOverflow(390, 380)
  assert.equal(evidence.evidence.overflowPx, 0, 'overflow must clamp to 0, never negative')
  assert.equal(classification.outcome, 'good')
  assert.equal(findings[0].label, 'No clear issue found')
  assert.equal(findings[0].bucket, 'good')
})

test('positive: content exactly matching the viewport width is "good"', () => {
  const { classification } = runOverflow(390, 390)
  assert.equal(classification.outcome, 'good')
})

test('positive: overflow within the sub-pixel tolerance (<=2px) is still "good"', () => {
  const { classification } = runOverflow(390, 392)
  assert.equal(classification.outcome, 'good')
})

// ─── boundary: small, ambiguous overflow ────────────────────────────

test('boundary: a small (~10px) overflow is "manual-review-advisory" / "Worth a manual look"', () => {
  const { classification, findings } = runOverflow(390, 400)
  assert.equal(classification.outcome, 'manual-review-advisory')
  assert.equal(findings[0].label, 'Worth a manual look')
})

test('boundary: exactly at the clear-issue threshold (20px) is still "manual-review-advisory"', () => {
  const { classification } = runOverflow(390, 410)
  assert.equal(classification.outcome, 'manual-review-advisory')
})

// ─── negative: clear overflow ───────────────────────────────────────

test('negative: a large overflow is "improve" / "Likely opportunity"', () => {
  const { evidence, classification, findings } = runOverflow(390, 900)
  assert.equal(evidence.evidence.overflowPx, 510)
  assert.equal(classification.outcome, 'improve')
  assert.equal(findings[0].label, 'Likely opportunity')
  assert.equal(findings[0].bucket, 'improve')
})

// ─── honesty checks ──────────────────────────────────────────────────

test('overflow findings never claim a score, WCAG compliance, or an automatic rejection', () => {
  const { classification, findings } = runOverflow(390, 900)
  const serialized = JSON.stringify({ classification, findings })
  for (const forbidden of ['score', 'wcag', 'reject', 'compliant']) {
    assert.ok(!serialized.toLowerCase().includes(forbidden), `must not contain "${forbidden}"`)
  }
})

test('overflow standardsBasis is product-policy, not a cited standard — the thresholds are not drawn from a spec', () => {
  const { classification } = runOverflow(390, 900)
  assert.equal(classification.standardsBasis.type, 'product-policy')
})

test('overflow evidenceRefs is always empty — no audit trail is claimed for this release', () => {
  const { classification } = runOverflow(390, 900)
  assert.deepEqual(classification.evidenceRefs, [])
})
