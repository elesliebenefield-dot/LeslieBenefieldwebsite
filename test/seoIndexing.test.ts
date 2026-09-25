// Technical SEO consistency — sitemap.xml, robots.txt, and canonical tags.
// Checks the real production build (dist/, rebuilt fresh in before()) against
// the site's actual routes (vercel.json rewrites + "/") and each page's own
// indexing directives, so the three can't drift apart:
//   - every sitemap URL is a real, indexable route whose single canonical
//     tag matches that URL exactly;
//   - every indexable page is in the sitemap; no noindex page, redirect
//     source, or .html duplicate is;
//   - robots.txt references the sitemap and blocks nothing (the demos'
//     noindex tags must stay visible to crawlers).
//
// Run with: node --test test/seoIndexing.test.ts

import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '..')
const DIST = path.join(ROOT, 'dist')
const ORIGIN = 'https://www.websitesbyleslie.com'

interface Route { route: string; file: string; html: string; canonicals: string[]; noindex: boolean }

let routes: Route[] = []
let redirectSources: string[] = []
let sitemapLocs: string[] = []
let robots = ''

before(async () => {
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' })

  const vercel = JSON.parse(await readFile(path.join(ROOT, 'vercel.json'), 'utf8'))
  redirectSources = vercel.redirects.map((r: { source: string }) => r.source)
  const pairs: [string, string][] = [
    ['/', '/index.html'],
    ...vercel.rewrites.map((r: { source: string; destination: string }) => [r.source, r.destination] as [string, string]),
  ]
  routes = await Promise.all(pairs.map(async ([route, dest]) => {
    const html = await readFile(path.join(DIST, dest), 'utf8')
    const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]*)"/g)].map(m => m[1])
    const noindex = /<meta name="robots" content="[^"]*noindex/.test(html)
    return { route, file: dest, html, canonicals, noindex }
  }))

  const xml = await readFile(path.join(DIST, 'sitemap.xml'), 'utf8')
  sitemapLocs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(m => m[1])
  robots = await readFile(path.join(DIST, 'robots.txt'), 'utf8')
})

test('sitemap lists exactly the indexable core pages, tools hub, showcase, and calculator pages', () => {
  assert.deepEqual(sitemapLocs, [
    '/', '/services', '/faq', '/check', '/website-checklist', '/privacy-policy',
    '/business-tools', '/real-estate-tools', '/bakery-pricing-guide', '/tools-bakery-pricing',
  ].map(r => ORIGIN + r))
})

test('every sitemap URL is a real route, not noindex, and its single canonical matches the URL exactly', () => {
  for (const loc of sitemapLocs) {
    assert.ok(loc.startsWith(ORIGIN + '/'), `${loc} must use ${ORIGIN}`)
    const route = routes.find(r => ORIGIN + r.route === loc)
    assert.ok(route, `${loc} does not match any real route`)
    assert.equal(route!.noindex, false, `${loc} is noindex and must not be in the sitemap`)
    assert.deepEqual(route!.canonicals, [loc], `${route!.file} must have exactly one canonical, pointing to ${loc}`)
  }
})

test('every indexable route is in the sitemap; no noindex page, redirect, or .html duplicate is', () => {
  for (const r of routes) {
    const listed = sitemapLocs.includes(ORIGIN + r.route)
    assert.equal(listed, !r.noindex, `${r.route} (${r.file}): indexable=${!r.noindex}, in sitemap=${listed}`)
  }
  for (const src of redirectSources) assert.ok(!sitemapLocs.includes(ORIGIN + src), `redirect source ${src} must not be listed`)
  assert.ok(sitemapLocs.every(l => !l.endsWith('.html')), 'no .html duplicate URLs')
  assert.equal(new Set(sitemapLocs).size, sitemapLocs.length, 'no duplicate entries')
})

test('sitemap has no invented lastmod dates', async () => {
  const xml = await readFile(path.join(DIST, 'sitemap.xml'), 'utf8')
  const withoutComments = xml.replace(/<!--[\s\S]*?-->/g, '')
  assert.ok(!withoutComments.includes('<lastmod>'))
})

test('every page has at most one canonical, and every canonical points to its own route (not the homepage)', () => {
  for (const r of routes) {
    assert.ok(r.canonicals.length <= 1, `${r.file} has ${r.canonicals.length} canonical tags`)
    if (r.canonicals.length === 1) assert.equal(r.canonicals[0], ORIGIN + r.route, `${r.file} canonical must be its own URL`)
  }
})

test('any og:url matches the page\'s canonical URL', () => {
  const withOgUrl = routes.filter(r => /property="og:url"/.test(r.html))
  assert.ok(withOgUrl.length >= 2, 'expected og:url on at least the homepage and the Real Estate showcase')
  for (const r of withOgUrl) {
    const ogUrl = r.html.match(/<meta property="og:url"\s+content="([^"]*)"/)?.[1]
    assert.equal(ogUrl, r.canonicals[0], `${r.file} og:url must match its canonical`)
  }
})

test('demo planners keep their noindex tags', () => {
  const demos = routes.filter(r => r.route.startsWith('/tools/real-estate/') ||
    ['/tools-custom-bakery-order', '/tools-plumbing-visit', '/tools-food-truck-event'].includes(r.route))
  assert.equal(demos.length, 9)
  for (const d of demos) assert.ok(d.noindex, `${d.route} must stay noindex`)
})

test('robots.txt references the sitemap and does not block any page or asset', () => {
  assert.match(robots, /^User-agent: \*$/m)
  assert.match(robots, /^Sitemap: https:\/\/www\.websitesbyleslie\.com\/sitemap\.xml$/m)
  const disallows = [...robots.matchAll(/^Disallow:\s*(\S*)/gim)].map(m => m[1]).filter(Boolean)
  assert.deepEqual(disallows, [], 'nothing may be disallowed — crawlers must be able to see the demos\' noindex tags')
})
