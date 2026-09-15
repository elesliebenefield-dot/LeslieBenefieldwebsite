// Real-browser integration test for the Bakery Pricing Calculator's data
// layer. Bundles the actual production repository source (unmodified) with
// esbuild and runs it inside a real, headless Chrome instance via
// Puppeteer — exercising the browser's genuine IndexedDB implementation,
// not fake-indexeddb and not a hand-rolled mock. This is the companion to
// the fake-indexeddb-based tests in bakeryPricingDb/IngredientRepository/
// RecipeRepository.test.ts, which cover the full behavioral surface fast;
// this test exists to catch any divergence between that polyfill and a
// real browser.
//
// Run with: node --test test/tools/bakeryPricingRealBrowserData.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import esbuild from 'esbuild'
import puppeteer, { type Browser } from 'puppeteer-core'

const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ROOT = path.resolve(import.meta.dirname, '..', '..')

let browser: Browser
let server: Server
let baseUrl: string
let workDir: string

before(async () => {
  workDir = await mkdtemp(path.join(tmpdir(), 'bakery-pricing-real-browser-'))

  await esbuild.build({
    entryPoints: [path.join(ROOT, 'test-support/bakery-pricing-fixtures/bakeryPricingRealBrowserCheck.ts')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    outfile: path.join(workDir, 'check.js'),
  })

  await writeFile(
    path.join(workDir, 'index.html'),
    '<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module" src="/check.js"></script></body></html>',
  )

  server = createServer(async (req, res) => {
    const rawPath = req.url?.split('?')[0] ?? '/'
    const filePath = path.join(workDir, rawPath === '/' ? 'index.html' : rawPath)
    try {
      const { readFile } = await import('node:fs/promises')
      const data = await readFile(filePath)
      const ext = path.extname(filePath)
      const contentType = ext === '.js' ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8'
      res.writeHead(200, { 'content-type': contentType })
      res.end(data)
    } catch {
      res.writeHead(404)
      res.end('not found')
    }
  })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('failed to start server')
  baseUrl = `http://127.0.0.1:${address.port}`

  browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: true })
})

after(async () => {
  await browser.close()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await rm(workDir, { recursive: true, force: true })
})

test('real browser IndexedDB: exact decimal round trip, blocked deletion while referenced, deletion once unreferenced', async () => {
  const page = await browser.newPage()
  try {
    await page.goto(`${baseUrl}/`, { waitUntil: 'load' })
    await page.waitForFunction(() => (window as unknown as { __RESULT__?: unknown }).__RESULT__ !== undefined, {
      timeout: 10000,
    })
    const result = await page.evaluate(() => (window as unknown as { __RESULT__: { ok: boolean; details: Record<string, unknown>; error?: string } }).__RESULT__)

    assert.equal(result.error, undefined, `real-browser check threw: ${result.error}`)
    assert.equal(result.ok, true)
    assert.equal(result.details.exactDecimalRoundTrip, true, 'exact decimal string must survive a real IndexedDB round trip')
    assert.equal(result.details.blockedDeletionWhileReferenced, true, 'real browser IndexedDB must enforce the referenced-ingredient delete block')
    assert.equal(result.details.deletedOnceUnreferenced, true, 'deletion must succeed once the ingredient is no longer referenced')
  } finally {
    await page.close()
  }
})
