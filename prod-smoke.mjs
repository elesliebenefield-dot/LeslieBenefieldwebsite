import puppeteer from 'puppeteer-core'
import assert from 'node:assert/strict'

const CHROME  = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE    = 'https://lesliebenefieldwebsite.vercel.app'
const PASS    = []
const FAIL    = []

function ok(label)  { PASS.push(label); console.log('✔', label) }
function fail(label, err) { FAIL.push(label); console.error('✖', label, '-', err) }

async function check(label, fn) {
  try { await fn(); ok(label) } catch(e) { fail(label, e.message ?? e) }
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })

// ── 1. /tools-plumbing-visit — HTTP 200 ─────────────────────────────────────
await check('/tools-plumbing-visit returns 200', async () => {
  const res = await fetch(`${BASE}/tools-plumbing-visit`)
  assert.equal(res.status, 200)
})

// ── 2. Plumbing planner Stage 1 → Results smoke test ───────────────────────
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
await page.goto(`${BASE}/tools-plumbing-visit`, { waitUntil: 'networkidle2', timeout: 30000 })

await check('plumbing: page title correct', async () => {
  const t = await page.title()
  assert.equal(t, 'Plumbing Service Visit Planner')
})

await check('plumbing: brand shows "Your Plumbing Company"', async () => {
  const b = await page.$eval('.tool-header-brand', el => el.textContent?.trim())
  assert.equal(b, 'Your Plumbing Company')
})

await check('plumbing: progress shows 1 of 3', async () => {
  const p = await page.$eval('.tool-progress-count', el => el.textContent?.trim())
  assert.equal(p, '1 of 3')
})

await check('plumbing: Stage 1 has 9 concern options', async () => {
  const n = await page.$$eval('input[name="concernType"]', els => els.length)
  assert.equal(n, 9)
})

// Fill Stage 1
await page.click('label[for="concernType-dripping_leak"]')
await page.click('label[for="activeWater-slow_drip"]')
await page.click('button.tool-nav-next')

await check('plumbing: Stage 2 progress shows 2 of 3', async () => {
  await page.waitForSelector('.tool-progress-count')
  const p = await page.$eval('.tool-progress-count', el => el.textContent?.trim())
  assert.equal(p, '2 of 3')
})

// Fill Stage 2
await page.click('label[for="homeArea-bathroom"]')
await page.click('label[for="firstNoticed-within_week"]')
await page.click('label[for="changeAnswer-same"]')
await page.click('label[for="history-first_time"]')
await page.click('label[for="waterElsewhere-no"]')
await page.click('button.tool-nav-next')

await check('plumbing: Stage 3 progress shows 3 of 3', async () => {
  await page.waitForSelector('.tool-progress-count')
  const p = await page.$eval('.tool-progress-count', el => el.textContent?.trim())
  assert.equal(p, '3 of 3')
})

// Fill Stage 3
await page.click('label[for="propertyType-single_family"]')
await page.click('label[for="recentWork-no"]')
await page.click('button.tool-nav-next')

await check('plumbing: results screen loads', async () => {
  await page.waitForSelector('.tool-results', { timeout: 8000 })
})

await check('plumbing: results brief contains concern type', async () => {
  const text = await page.$eval('.tool-results', el => el.textContent ?? '')
  assert.ok(/dripping/i.test(text), `Brief text: ${text.slice(0, 200)}`)
})

await check('plumbing: disclaimer present on results', async () => {
  const el = await page.$('.tool-disclaimer')
  assert.ok(el !== null)
})

await page.close()

// ── 3. /services — pricing, payment heading, demo cards ─────────────────────
const sp = await browser.newPage()
await sp.setViewport({ width: 1280, height: 900 })
await sp.goto(`${BASE}/services`, { waitUntil: 'networkidle2', timeout: 30000 })

await check('/services: website prices all present', async () => {
  const text = await sp.$eval('.pricing-grid', el => el.textContent ?? '')
  assert.ok(text.includes('Complimentary'))
  assert.ok(text.includes('Starter Website'))
  assert.ok(text.includes('Starting at $500'))
  assert.ok(text.includes('Custom quote'))
})

await check('/services: Interactive Tool Pricing section present', async () => {
  await sp.waitForSelector('.pricing-tools-inner')
  const text = await sp.$eval('.pricing-tools-inner', el => el.textContent ?? '')
  assert.ok(text.includes('Interactive Tool Pricing'))
  assert.ok(text.includes('Tool Setup'))
  assert.ok(text.includes('customized (per tool)'))
  assert.ok(text.includes('Starting at $150'))
  assert.ok(text.includes('Suite of tools'))
  assert.ok(text.includes('Tool Hosting'))
  assert.ok(text.includes('$10/month'))
  assert.ok(text.includes('Adding a tool to your new website?'))
  for (const retired of ['$300', '$500', '$15/month', '$25/month', '$35/month', 'Hosting & Care']) {
    assert.ok(!text.includes(retired), `retired tool pricing still shown: ${retired}`)
  }
})

await check('/services: payment heading inside card at 1280px (no overflow)', async () => {
  const { fits } = await sp.evaluate(() => {
    const h = document.querySelector('.pricing-payment-inner .section-title')
    const c = document.querySelector('.pricing-payment-inner')
    if (!h || !c) return { fits: false }
    return { fits: h.getBoundingClientRect().right <= c.getBoundingClientRect().right + 1 }
  })
  assert.ok(fits)
})

await check('/services: payment heading inside card at 320px (no overflow)', async () => {
  await sp.setViewport({ width: 320, height: 900 })
  const { fits } = await sp.evaluate(() => {
    const h = document.querySelector('.pricing-payment-inner .section-title')
    const c = document.querySelector('.pricing-payment-inner')
    if (!h || !c) return { fits: false }
    return { fits: h.getBoundingClientRect().right <= c.getBoundingClientRect().right + 1 }
  })
  assert.ok(fits)
})
await sp.setViewport({ width: 1280, height: 900 })

await check('/services: payment terms wording unchanged', async () => {
  const text = await sp.$eval('.pricing-payment-inner', el => el.textContent ?? '')
  assert.ok(/simple, clear payment expectations/i.test(text))
  assert.ok(/50% project deposit/i.test(text))
})

await check('/services: three demo cards present', async () => {
  const n = await sp.$$eval('.pricing-demo-card', els => els.length)
  assert.equal(n, 3)
})

await check('/services: bakery demo card links to /tools-custom-bakery-order', async () => {
  const links = await sp.$$eval('.pricing-demo-link', els => els.map(e => e.getAttribute('href')))
  assert.ok(links.includes('/tools-custom-bakery-order'))
})

await check('/services: plumbing demo card links to /tools-plumbing-visit', async () => {
  const links = await sp.$$eval('.pricing-demo-link', els => els.map(e => e.getAttribute('href')))
  assert.ok(links.includes('/tools-plumbing-visit'))
})

await check('/services: real estate suite card links to /real-estate-tools', async () => {
  const links = await sp.$$eval('.pricing-demo-link', els => els.map(e => e.getAttribute('href')))
  assert.ok(links.includes('/real-estate-tools'))
})

await sp.close()

// ── 4. /real-estate-tools still available ────────────────────────────────────
await check('/real-estate-tools returns 200', async () => {
  const res = await fetch(`${BASE}/real-estate-tools`)
  assert.equal(res.status, 200)
})

const rp = await browser.newPage()
await rp.goto(`${BASE}/real-estate-tools`, { waitUntil: 'networkidle2', timeout: 30000 })
await check('/real-estate-tools: showcase loads (no homepage hero)', async () => {
  const hero = await rp.$('.hero')
  assert.equal(hero, null)
  await rp.waitForSelector('.rts-hero-card', { timeout: 8000 })
})
await rp.close()

// ── 5. /tools-custom-bakery-order still available ────────────────────────────
await check('/tools-custom-bakery-order returns 200', async () => {
  const res = await fetch(`${BASE}/tools-custom-bakery-order`)
  assert.equal(res.status, 200)
})

const bp = await browser.newPage()
await bp.goto(`${BASE}/tools-custom-bakery-order`, { waitUntil: 'networkidle2', timeout: 30000 })
await check('/tools-custom-bakery-order: bakery planner loads', async () => {
  const t = await bp.title()
  assert.match(t, /bakery|order/i)
  const hero = await bp.$('.hero')
  assert.equal(hero, null)
})
await bp.close()

await browser.close()

console.log(`\n─── ${PASS.length} pass  ${FAIL.length} fail ───`)
if (FAIL.length > 0) process.exit(1)
