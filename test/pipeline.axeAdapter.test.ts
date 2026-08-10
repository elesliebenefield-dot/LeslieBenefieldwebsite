// Sub-patch 2e (simplified accessibility cross-check, 1-2 hour cap) —
// real-Chrome tests for src/lib/offline/oracle/axeAdapter.ts. Local
// Chrome only (never @sparticuz/chromium's Lambda-only binary); local,
// self-contained HTML fixtures only — never a real third-party site.
// If local Chrome isn't present at the expected path, these tests skip
// rather than fail, so the rest of the suite is unaffected.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { runAxeAgainstFixture, resolveDefaultChromePathForAxe } from '../src/lib/offline/oracle/axeAdapter.ts'

const CHROME_PATH = resolveDefaultChromePathForAxe()
const chromeAvailable = existsSync(CHROME_PATH)

function skippableTest(name: string, fn: () => Promise<void>): void {
  test(name, { skip: !chromeAvailable ? 'local Chrome not found at the expected path — skipping real-browser tests' : false }, fn)
}

const FIXTURES_DIR = path.resolve(import.meta.dirname, 'fixtures/visual-checker/axe')
async function loadFixture(name: string): Promise<string> {
  return readFile(path.join(FIXTURES_DIR, name), 'utf8')
}

skippableTest('positive fixture: a genuinely clean page reports zero violations and zero inconclusive findings', async () => {
  const html = await loadFixture('positive-accessible.html')
  const result = await runAxeAgainstFixture(html)
  assert.equal(result.status, 'ok')
  if (result.status === 'ok') {
    assert.deepEqual(result.violations, [])
    assert.deepEqual(result.inconclusive, [])
  }
})

skippableTest('negative fixture: a page missing lang/alt/label/landmark reports multiple real violations, each with a rule id, impact, and help URL', async () => {
  const html = await loadFixture('negative-missing-basics.html')
  const result = await runAxeAgainstFixture(html)
  assert.equal(result.status, 'ok')
  if (result.status === 'ok') {
    assert.ok(result.violations.length >= 3, `expected multiple violations, got ${result.violations.length}`)
    const ruleIds = result.violations.map((v) => v.ruleId)
    for (const expected of ['html-has-lang', 'image-alt', 'label']) {
      assert.ok(ruleIds.includes(expected), `expected "${expected}" among violations: ${JSON.stringify(ruleIds)}`)
    }
    for (const finding of result.violations) {
      assert.equal(typeof finding.ruleId, 'string')
      assert.ok(finding.ruleId.length > 0)
      assert.equal(typeof finding.helpUrl, 'string')
      assert.ok(finding.helpUrl.startsWith('https://'))
      assert.ok(['minor', 'moderate', 'serious', 'critical', null].includes(finding.impact), `unexpected impact value: ${finding.impact}`)
      assert.ok(Array.isArray(finding.targets) && finding.targets.length > 0)
    }
  }
})

skippableTest('boundary fixture: text over a background image produces a genuine inconclusive color-contrast finding, not a fabricated pass or violation', async () => {
  const html = await loadFixture('boundary-contrast-background-image.html')
  const result = await runAxeAgainstFixture(html)
  assert.equal(result.status, 'ok')
  if (result.status === 'ok') {
    assert.ok(!result.violations.some((v) => v.ruleId === 'color-contrast'), 'must not be reported as a definite violation')
    const inconclusiveContrast = result.inconclusive.find((f) => f.ruleId === 'color-contrast')
    assert.ok(inconclusiveContrast, 'color-contrast must be reported as inconclusive')
    if (inconclusiveContrast) {
      assert.equal(typeof inconclusiveContrast.reason, 'string')
      assert.ok(inconclusiveContrast.reason.length > 0, 'the inconclusive reason must be a real, non-empty explanation')
    }
  }
})

skippableTest('an unresolvable executablePath is reported as "unavailable" with a bounded reason, never thrown, and never silently treated as a clean/passing result', async () => {
  const html = await loadFixture('positive-accessible.html')
  const result = await runAxeAgainstFixture(html, { executablePath: '/nonexistent/path/to/chrome-binary' })
  assert.equal(result.status, 'unavailable')
  if (result.status === 'unavailable') {
    assert.equal(typeof result.reason, 'string')
    assert.ok(result.reason.length > 0)
  }
})

skippableTest('local-fixtures-only guarantee: a fixture referencing an external URL never reaches the real network — the request is aborted, and the page still resolves (fails closed, not hung)', async () => {
  const html = `<!DOCTYPE html><html lang="en"><body><main><h1>x</h1><img src="https://example.invalid/should-never-be-requested.png" alt="external"></main></body></html>`
  const result = await runAxeAgainstFixture(html, { timeoutMs: 5000 })
  // The point of this test is that it completes at all (network request
  // aborted, not hung waiting on a real DNS/connect attempt) and returns
  // a typed result either way — not a specific violation/pass outcome.
  assert.ok(result.status === 'ok' || result.status === 'unavailable')
})

skippableTest('no scoring, no WCAG-compliance claim, and no aggregate outcome is ever produced by the adapter\'s result shape', async () => {
  const html = await loadFixture('positive-accessible.html')
  const result = await runAxeAgainstFixture(html)
  assert.equal(result.status, 'ok')
  if (result.status === 'ok') {
    const serialized = JSON.stringify(result)
    for (const forbidden of ['score', 'wcagCompliant', 'passed', 'grade']) {
      assert.ok(!serialized.toLowerCase().includes(forbidden.toLowerCase()), `result must not contain "${forbidden}"`)
    }
  }
})
