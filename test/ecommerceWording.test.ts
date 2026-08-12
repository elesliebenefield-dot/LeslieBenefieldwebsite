// Ecommerce-wording-fix release — the "Ecommerce / marketplace" finding
// (api/check-website.ts) previously said "Your website looks like an
// online store or marketplace listing," which overclaims: the detection
// (hasEcommerceSignal) fires on platform CODE signals (e.g. WooCommerce
// CSS classes), which can be present purely from a theme/plugin even on
// a site that never sells anything online — discovered via a real site
// (a security-guard/patrol-services business) whose homepage had zero
// shop/cart/product links but did carry WooCommerce CSS. The wording now
// describes the software signal found, conservatively, rather than
// asserting what the business is or what the page "looks like".
//
// hasEcommerceSignal's own trigger conditions are NOT touched by this
// release — only the visitor-facing label/detail text of the finding it
// produces. Real handler, real local fixture HTTP server — never mocked
// — via handleCheckWebsite's test-only deps injection (same established
// pattern as test/scoringRubric.test.ts).
//
// Run with: node --import ./test-support/register-ts-sibling-loader.mjs --test test/ecommerceWording.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { handleCheckWebsite } from '../api/check-website.ts'
import { buildCombinedEmailBody } from '../src/lib/emailBody.ts'
import type { CheckResponse } from '../src/lib/websiteCheck.ts'

function mockRes() {
  const state: { statusCode: number; body: CheckResponse | null } = { statusCode: 0, body: null }
  const res = {
    status(code: number) {
      state.statusCode = code
      return res
    },
    json(b: CheckResponse) {
      state.body = b
    },
  }
  return { res, state }
}

function depsFor(port: number) {
  return {
    classify: (ip: string) => ip !== '127.0.0.1',
    allowedPorts: [String(port)],
  }
}

async function startServer(handlerFn: http.RequestListener): Promise<{ server: http.Server; port: number }> {
  const server = http.createServer(handlerFn)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('failed to bind fixture server')
  return { server, port: address.port }
}

async function checkFixture(port: number): Promise<CheckResponse> {
  const { res, state } = mockRes()
  await handleCheckWebsite({ method: 'POST', body: JSON.stringify({ url: `http://127.0.0.1:${port}/` }) }, res, depsFor(port))
  assert.equal(state.statusCode, 200)
  if (!state.body) throw new Error('no response body')
  return state.body
}

// Mirrors the real trigger: a service-business page whose CSS happens to
// include WooCommerce class names (e.g. from an unused theme feature),
// with substantial real content and no shop/cart/product links anywhere
// — the exact shape that produced the overclaiming wording in production.
const SERVICE_BUSINESS_WITH_WOOCOMMERCE_CSS = `<!DOCTYPE html>
<html>
<head>
  <title>Example Security Services — Guard & Patrol</title>
  <meta name="description" content="Licensed security guard and patrol services for businesses and events, available around the clock.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>.woocommerce nav.woocommerce-pagination ul li a:hover { color: red; }</style>
</head>
<body>
  <h1>Example Security Services</h1>
  <p>We provide licensed guard and patrol services for businesses, warehouses, and events across the region. Call us any time, day or night, for a free consultation about protecting your property.</p>
  <footer>Contact us: (555) 123-4567 or info@example-security.test</footer>
</body>
</html>`

async function findEcommerceFinding(result: CheckResponse) {
  if (!result.ok || result.status !== 'scored') throw new Error('expected a scored result')
  const finding = result.findings.find((f) => f.id === 'ecommerce')
  if (!finding) throw new Error('expected an ecommerce finding to fire for the WooCommerce-CSS fixture')
  return finding
}

test('the ecommerce finding fires on platform-code signals (detection unchanged) but no longer claims the site "looks like an online store"', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(SERVICE_BUSINESS_WITH_WOOCOMMERCE_CSS)
  })
  try {
    const result = await checkFixture(port)
    const finding = await findEcommerceFinding(result)

    assert.ok(!/looks like an online store/i.test(finding.detail), 'must not claim the site looks like an online store')
    assert.ok(!/marketplace listing/i.test(finding.detail), 'must not claim the site looks like a marketplace listing')
    assert.equal(finding.label, 'Ecommerce software detected')
    assert.match(finding.detail, /may use ecommerce software/i)
    assert.match(finding.detail, /can happen even on a site that (doesn.t|does not) sell anything online/i, 'must acknowledge the theme/plugin false-trigger case')
    assert.match(finding.detail, /if you do sell products or manage an online store/i, 'the specialist referral must be conditional, not assumed')
    assert.equal(finding.bucket, 'specialist')
    assert.equal(finding.points, 0, 'must remain unscored — this release changes wording only, never scoring')
  } finally {
    server.close()
  }
})

test('the prefilled email carries the same conservative wording, never the old overclaiming phrase', async () => {
  const { server, port } = await startServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(SERVICE_BUSINESS_WITH_WOOCOMMERCE_CSS)
  })
  try {
    const result = await checkFixture(port)
    if (!result.ok || result.status !== 'scored') throw new Error('expected a scored result')
    const body = buildCombinedEmailBody(result, null, { detailLimit: null, includeGoodSections: true, unverifiedSummaryOnly: false })

    assert.match(body, /Ecommerce software detected/)
    assert.match(body, /may use ecommerce software/i)
    assert.ok(!/looks like an online store/i.test(body))
    assert.ok(!/marketplace listing/i.test(body))
  } finally {
    server.close()
  }
})
