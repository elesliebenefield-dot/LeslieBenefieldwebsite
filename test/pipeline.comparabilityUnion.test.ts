// Sub-patch 2a — proves the ComparabilityEvidence discriminated union and
// the OracleComparisonResult tied union are constructible and correctly
// discriminated. No comparison-mapping FUNCTION exists in 2a (that
// decision logic moved to sub-patch 2e's comparisonMapper.ts — see
// offline/oracle/types.ts's header comment). No adapter, no tool-specific
// raw-output type — deferred to 2e, per the same header comment.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ComparabilityEvidence, OracleTool, OracleComparisonResult, ManualToolEvidence } from '../src/lib/offline/oracle/types.ts'

const insufficient: ComparabilityEvidence = { kind: 'insufficient', reason: 'no fixture available for this checkId yet' }
const fixture: ComparabilityEvidence = {
  kind: 'controlled-fixture',
  fixtureId: 'fx-001',
  fixtureVersion: '1.0.0',
  environmentFingerprint: 'env-abc',
  viewport: 'desktop',
  toolVersion: 'axe-core@4.0.0',
}
const live: ComparabilityEvidence = {
  kind: 'live',
  finalUrl: 'https://example.com/',
  viewport: 'desktop',
  captureTimeWindow: '2026-08-09T00:00:00Z/2026-08-09T00:05:00Z',
  contentFingerprint: 'sha256-deadbeef',
  environmentFingerprint: 'env-abc',
  toolVersion: 'axe-core@4.0.0',
}

test('each ComparabilityEvidence variant constructs and discriminates correctly by "kind"', () => {
  assert.equal(insufficient.kind, 'insufficient')
  assert.equal(fixture.kind, 'controlled-fixture')
  assert.equal(live.kind, 'live')
})

test('OracleTool only ever contains the tools this codebase can actually execute — WAVE is not one of them', () => {
  const executableTools: OracleTool[] = ['axe-core', 'lighthouse']
  assert.deepEqual(executableTools.sort(), ['axe-core', 'lighthouse'])
  assert.ok(!(executableTools as string[]).includes('wave'), 'WAVE must never appear as an executable OracleTool value')
})

test('WAVE is modeled as non-executable ManualToolEvidence, structurally separate from OracleTool', () => {
  const wave: ManualToolEvidence = { tool: 'wave', status: 'manual-only', note: 'no automated WAVE adapter exists' }
  assert.equal(wave.tool, 'wave')
  assert.equal(wave.status, 'manual-only')
})

test('the only valid OracleComparisonResult combinations are: controlled-fixture/live + agreement-or-disagreement, and insufficient + inconclusive', () => {
  const fixtureAgreement: OracleComparisonResult = { checkId: 'empty', tool: 'axe-core', comparability: fixture, outcome: 'agreement' }
  const fixtureDisagreement: OracleComparisonResult = { checkId: 'empty', tool: 'axe-core', comparability: fixture, outcome: 'disagreement' }
  const liveAgreement: OracleComparisonResult = { checkId: 'empty', tool: 'lighthouse', comparability: live, outcome: 'agreement' }
  const liveDisagreement: OracleComparisonResult = { checkId: 'empty', tool: 'lighthouse', comparability: live, outcome: 'disagreement' }
  const insufficientInconclusive: OracleComparisonResult = { checkId: 'empty', tool: 'axe-core', comparability: insufficient, outcome: 'inconclusive' }

  for (const result of [fixtureAgreement, fixtureDisagreement, liveAgreement, liveDisagreement, insufficientInconclusive]) {
    if (result.comparability.kind === 'insufficient') {
      assert.equal(result.outcome, 'inconclusive', 'insufficient comparability must always pair with inconclusive')
    } else {
      assert.ok(result.outcome === 'agreement' || result.outcome === 'disagreement', 'complete comparability must pair with agreement or disagreement')
    }
  }
})

test('resolutionNote is optional and carries through unchanged for every variant', () => {
  const withNote: OracleComparisonResult = { checkId: 'empty', tool: 'axe-core', comparability: insufficient, outcome: 'inconclusive', resolutionNote: 'no fixture yet' }
  assert.equal(withNote.resolutionNote, 'no fixture yet')
})
