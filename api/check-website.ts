// Vercel serverless function: POST /api/check-website
// Performs a small set of friendly, non-technical website health checks.
// Nothing submitted here is stored — the result is computed and returned
// in a single request/response cycle.

import { normalizeWebsiteUrl } from '../src/lib/websiteCheck.js'
import type { Finding, CheckResponse } from '../src/lib/websiteCheck.js'
import {
  assertSafeUrl,
  UnsafeUrlError,
  evaluateContactSignal,
  evaluateHomepageLinks,
  type LinksEvaluation,
} from '../src/lib/contactLinksCheck.js'

// ─── Safety limits ──────────────────────────────────────────────
const REQUEST_TIMEOUT_MS = 8000
const MAX_RESPONSE_BYTES = 2_000_000 // 2 MB of HTML is far more than we need
const MAX_REDIRECTS = 5
const USER_AGENT = 'WebsitesByLeslie-Checkup/1.0 (+https://websitesbyleslie.com)'

// assertSafeUrl/UnsafeUrlError (SSRF-safe URL validation) and the
// contact/links detection + safety-boundary functions now live in
// ../src/lib/contactLinksCheck.js — shared with api/check-visual.ts's
// rendered-DOM fallback for pages this static check can't verify. See
// that module for the moved implementation (unchanged).

interface FetchResult {
  finalUrl: string
  status: number
  html: string
  elapsedMs: number
  usedHttps: boolean
  redirected: boolean
}

/** Follows redirects manually so every hop can be safety-checked before being followed. */
async function safeFetchHtml(startUrl: URL): Promise<FetchResult> {
  let current = startUrl
  let redirected = false
  const started = Date.now()

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertSafeUrl(current)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(current.toString(), {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*' },
      })
    } catch (err) {
      clearTimeout(timer)
      if ((err as Error).name === 'AbortError') {
        throw new Error('The website took too long to respond.')
      }
      throw new Error('The website couldn’t be reached.')
    }
    clearTimeout(timer)

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) throw new Error('The website redirected without a destination.')
      let next: URL
      try {
        next = new URL(location, current)
      } catch {
        throw new Error('The website redirected to an invalid address.')
      }
      current = next
      redirected = true
      continue
    }

    const html = await readBodyCapped(res, MAX_RESPONSE_BYTES)
    return {
      finalUrl: current.toString(),
      status: res.status,
      html,
      elapsedMs: Date.now() - started,
      usedHttps: current.protocol === 'https:',
      redirected,
    }
  }

  throw new Error('The website redirected too many times.')
}

async function readBodyCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return ''
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done || !value) break
      received += value.byteLength
      if (received > maxBytes) {
        const allowed = maxBytes - (received - value.byteLength)
        if (allowed > 0) chunks.push(value.subarray(0, allowed))
        await reader.cancel().catch(() => {})
        break
      }
      chunks.push(value)
    }
  } catch {
    // Partial body is fine — we work with whatever we captured.
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf-8')
}

// ─── Lightweight HTML inspection helpers ────────────────────────

// Below this many characters of visible text, we treat the page as too thin to
// reliably assess (typically a JS application shell whose real content is rendered
// client-side, which this checker deliberately never executes). Calibrated against
// a client-rendered SPA (~60 chars), a real minimal static page (~140 chars), and
// ordinary content-bearing pages (2,000+ chars) — comfortably separates the two.
const THIN_CONTENT_THRESHOLD = 200

function visibleTextLength(html: string): number {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length
}

function isThinContent(html: string): boolean {
  return visibleTextLength(html) < THIN_CONTENT_THRESHOLD
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!match) return null
  const title = decodeEntities(match[1]).trim()
  return title || null
}

function findMetaContent(html: string, name: string): string | null {
  const metaTags = html.match(/<meta\s+[^>]*>/gi) || []
  for (const tag of metaTags) {
    const nameMatch = tag.match(/\bname\s*=\s*["']([^"']+)["']/i)
    if (!nameMatch || nameMatch[1].toLowerCase() !== name) continue
    const contentMatch = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)
    if (contentMatch) return decodeEntities(contentMatch[1]).trim()
  }
  return null
}

/**
 * Looks for signs the site is an ecommerce / marketplace site (platform fingerprints,
 * or a combination of cart/checkout links with product/collection links). This is a scope
 * signal only — it never affects the score, and never counts or estimates catalog size.
 */
function hasEcommerceSignal(html: string, finalUrl: string): boolean {
  const lower = html.toLowerCase()
  const hostname = (() => {
    try {
      return new URL(finalUrl).hostname.toLowerCase()
    } catch {
      return ''
    }
  })()

  // A marketplace shop hosted directly on etsy.com is the clearest possible signal —
  // the whole page belongs to the marketplace platform, not an independent business site.
  if (hostname === 'etsy.com' || hostname.endsWith('.etsy.com')) return true

  const platformSignals = [
    'cdn.shopify.com',
    'myshopify.com',
    'shopify-section',
    'woocommerce',
    'checkout.square.site',
    'square-online',
    'square.site',
    'cdn.bigcommerce.com',
    'wix-stores',
    'wixapps.net/storefront',
    // Etsy — both etsy.com shops and custom domains on Etsy's "Pattern" storefront product
    'assets.etsystatic.com',
    'etsy.com/shop',
    'www.etsy.com',
    'etsy.com/listing',
  ]
  if (platformSignals.some((s) => lower.includes(s))) return true

  const hasProductSchema =
    /"@type"\s*:\s*"product"/i.test(lower) || /itemtype\s*=\s*["'][^"']*schema\.org\/product["']/i.test(lower)
  if (hasProductSchema) return true

  const hasAddToCart = /add[\s-]?to[\s-]?cart/i.test(lower)
  const hasCartOrCheckoutLink = /href\s*=\s*["'][^"']*\/(cart|checkout)(?:[/"'?]|$)/i.test(html)
  const hasCatalogLink = /href\s*=\s*["'][^"']*\/(products|collections|shop)\//i.test(html)

  return (hasAddToCart && (hasCartOrCheckoutLink || hasCatalogLink)) || (hasCartOrCheckoutLink && hasCatalogLink)
}

// ─── Scoring ─────────────────────────────────────────────────────
interface ScoredFinding extends Finding {
  points: number
}

const SCORED_CHECK_COUNT = 7 // availability, https, mobile, title, meta-description, contact, links

interface ReportResult {
  score: number
  rawScore: number
  possiblePoints: number
  findings: Finding[]
  checksCompleted: number
  checksTotal: number
}

function buildReport(fetchResult: FetchResult, linksEval: LinksEvaluation | null): ReportResult {
  const { html, elapsedMs, usedHttps, status } = fetchResult
  const findings: ScoredFinding[] = []
  let score = 0
  let possiblePoints = 100
  let checksCompleted = SCORED_CHECK_COUNT

  // Availability (30 pts) — essential
  const available = status >= 200 && status < 400
  if (available) {
    score += 30
    findings.push({
      id: 'availability',
      label: 'Homepage availability',
      bucket: 'good',
      detail: 'Your homepage loaded successfully.',
      points: 30,
    })
  } else {
    findings.push({
      id: 'availability',
      label: 'Homepage availability',
      bucket: 'specialist',
      detail: `Your homepage responded with a server status of ${status}, which usually points to a hosting or server-side issue.`,
      points: 0,
    })
  }

  // Response time — informational only, not scored
  const seconds = (elapsedMs / 1000).toFixed(1)
  if (available) {
    if (elapsedMs < 2500) {
      findings.push({
        id: 'response-time',
        label: 'Response time',
        bucket: 'good',
        detail: `Your homepage responded in about ${seconds} seconds, which is a reasonable speed for visitors.`,
        points: 0,
      })
    } else {
      findings.push({
        id: 'response-time',
        label: 'Response time',
        bucket: 'improve',
        detail: `Your homepage took about ${seconds} seconds to respond. This is a rough measurement, not a full performance audit, but a faster response can help keep visitors from leaving early.`,
        points: 0,
      })
    }
  }

  // HTTPS (25 pts) — essential
  if (usedHttps) {
    score += 25
    findings.push({
      id: 'https',
      label: 'HTTPS / secure connection',
      bucket: 'good',
      detail: fetchResult.redirected
        ? 'Your website redirects visitors to a secure (HTTPS) connection.'
        : 'Your website loads over a secure (HTTPS) connection.',
      points: 25,
    })
  } else {
    findings.push({
      id: 'https',
      label: 'HTTPS / secure connection',
      bucket: 'improve',
      detail: 'Your website doesn’t appear to use a secure (HTTPS) connection. Most hosting providers offer free SSL certificates to enable this.',
      points: 0,
    })
  }

  if (available) {
    // Mobile viewport (15 pts) — essential
    const hasViewport = /<meta\s+[^>]*name\s*=\s*["']viewport["']/i.test(html)
    if (hasViewport) {
      score += 15
      findings.push({
        id: 'mobile',
        label: 'Mobile setup',
        bucket: 'good',
        detail: 'Your site includes the basic setup needed to display properly on phones and tablets.',
        points: 15,
      })
    } else {
      findings.push({
        id: 'mobile',
        label: 'Mobile setup',
        bucket: 'improve',
        detail: 'No mobile viewport setting was found. Without it, your site may look zoomed-out or hard to use on phones.',
        points: 0,
      })
    }

    // Page title (10 pts)
    const title = extractTitle(html)
    if (title && title.length >= 10) {
      score += 10
      findings.push({
        id: 'title',
        label: 'Page title',
        bucket: 'good',
        detail: 'Your homepage has a descriptive page title.',
        points: 10,
      })
    } else if (title) {
      score += 5
      findings.push({
        id: 'title',
        label: 'Page title',
        bucket: 'improve',
        detail: 'Your homepage has a page title, but it’s quite short. A clearer, more descriptive title can help visitors and search engines.',
        points: 5,
      })
    } else {
      findings.push({
        id: 'title',
        label: 'Page title',
        bucket: 'improve',
        detail: 'No page title was found. Titles help visitors and search engines understand what your page is about.',
        points: 0,
      })
    }

    // Meta description (10 pts)
    const description = findMetaContent(html, 'description')
    if (description && description.length >= 50) {
      score += 10
      findings.push({
        id: 'meta-description',
        label: 'Meta description',
        bucket: 'good',
        detail: 'Your homepage has a useful meta description.',
        points: 10,
      })
    } else if (description) {
      score += 5
      findings.push({
        id: 'meta-description',
        label: 'Meta description',
        bucket: 'improve',
        detail: 'Your homepage has a meta description, but it’s quite short. A fuller description can help your listing stand out in search results.',
        points: 5,
      })
    } else {
      findings.push({
        id: 'meta-description',
        label: 'Meta description',
        bucket: 'improve',
        detail: 'No meta description was found. This is the summary text often shown in search results.',
        points: 0,
      })
    }

    const thinContent = isThinContent(html)

    // Contact info (5 pts) — a positive match is always trustworthy; an absence is only
    // trustworthy when the page actually has enough rendered content to search through.
    // Detection/scoring itself lives in contactLinksCheck.ts, shared with
    // api/check-visual.ts's rendered-DOM fallback for thin-content pages.
    const contactEval = evaluateContactSignal(html)
    if (!contactEval.found && thinContent) {
      checksCompleted -= 1
      possiblePoints -= 5
      findings.push({
        id: 'contact',
        label: 'Contact information',
        bucket: 'unverified',
        detail: 'This website loads some content through browser scripts, so this automated check could not verify contact information. That does not necessarily mean anything is wrong.',
        points: 0,
      })
    } else {
      score += contactEval.points
      findings.push({ ...contactEval.finding, points: contactEval.points })
    }

    // Broken links sample (5 pts) — if we found no usable links to sample, we genuinely
    // don't know whether that's because there are none or because they're rendered by
    // scripts we don't execute, so this is left unverified rather than assumed clean.
    if (linksEval === null) {
      checksCompleted -= 1
      possiblePoints -= 5
      findings.push({
        id: 'links',
        label: 'Homepage links',
        bucket: 'unverified',
        detail: thinContent
          ? 'This website loads some content through browser scripts, so this automated check could not find enough links to sample. That does not necessarily mean anything is wrong.'
          : 'We didn’t find enough links on your homepage to sample.',
        points: 0,
      })
    } else {
      score += linksEval.points
      findings.push({ ...linksEval.finding, points: linksEval.points })
    }

    // Ecommerce / marketplace scope signal — informational only, never scored
    if (hasEcommerceSignal(html, fetchResult.finalUrl)) {
      findings.push({
        id: 'ecommerce',
        label: 'Ecommerce / marketplace',
        bucket: 'specialist',
        detail:
          'This appears to be an ecommerce or marketplace website. The checkup can review some general website basics, but it is not designed to evaluate product catalogs, checkout systems, marketplace listings, inventory, shipping, payments, or platform-specific integrations. These areas may require support from your platform provider or an ecommerce specialist.',
        points: 0,
      })
    }
  } else {
    // Mobile, title, meta description, contact, and links are all skipped together here.
    checksCompleted -= 5
    findings.push({
      id: 'content-checks',
      label: 'Page content checks',
      bucket: 'specialist',
      detail: 'We couldn’t evaluate your page title, meta description, mobile setup, contact information, or links because the homepage didn’t load successfully.',
      points: 0,
    })
  }

  const finalScore = possiblePoints > 0 ? Math.round((score / possiblePoints) * 100) : 0
  return {
    score: Math.max(0, Math.min(100, finalScore)),
    rawScore: score,
    possiblePoints,
    findings,
    checksCompleted,
    checksTotal: SCORED_CHECK_COUNT,
  }
}

// Scoped to what was actually checked, not the website as a whole — this
// is a limited set of technical basics (see WHAT_WE_CHECK in
// CheckPage.tsx), not a verdict on the site overall. `hasImproveFindings`
// gates the "a few small things"/"room to improve" language — a
// completed, fully-verified result with zero 'improve' findings must
// not claim there's something worth a look when there genuinely isn't
// one. `checksCompleted`/`checksTotal` add a qualification when not
// everything could be verified, so a high score from a partial check
// doesn't read as more complete than it was.
export function summaryFor(score: number, hasImproveFindings: boolean, checksCompleted: number, checksTotal: number): string {
  const incompleteNote = checksCompleted < checksTotal ? ' Not every check could be completed, so this reflects only what was verified.' : ''

  if (score >= 85) {
    const base = hasImproveFindings ? 'The technical basics checked look great, with just a few small things worth a look.' : 'The technical basics checked look great.'
    return `${base}${incompleteNote}`
  }
  if (score >= 65) {
    const base = hasImproveFindings ? 'The technical basics checked look solid, with some room to improve.' : 'The technical basics checked look solid.'
    return `${base}${incompleteNote}`
  }
  if (score >= 40) return `The technical basics checked are working, but a few common issues could be affecting visitors.${incompleteNote}`
  return `The technical basics checked ran into some notable issues. A closer look would likely help.${incompleteNote}`
}

// ─── Handler ─────────────────────────────────────────────────────
interface VercelRequest {
  method?: string
  body?: unknown
}
interface VercelResponse {
  status(code: number): VercelResponse
  json(body: CheckResponse): void
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' })
    return
  }

  let rawUrl: unknown
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    rawUrl = (body as { url?: unknown } | null)?.url
  } catch {
    res.status(400).json({ ok: false, error: 'Please enter a valid website address.' })
    return
  }

  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    res.status(400).json({ ok: false, error: 'Please enter a website address.' })
    return
  }

  const normalized = normalizeWebsiteUrl(rawUrl)
  if (!normalized) {
    res.status(400).json({ ok: false, error: 'That doesn’t look like a valid website address. Try something like yourbusiness.com.' })
    return
  }

  try {
    await assertSafeUrl(normalized)
  } catch (err) {
    const message = err instanceof UnsafeUrlError ? err.message : 'That website address isn’t supported.'
    res.status(400).json({ ok: false, error: message })
    return
  }

  let fetchResult: FetchResult
  try {
    fetchResult = await safeFetchHtml(normalized)
  } catch (err) {
    const reason = ((err as Error).message || 'an unknown error occurred').replace(/\.+$/, '')
    res.status(200).json({
      ok: true,
      input: normalized.toString(),
      finalUrl: normalized.toString(),
      score: 0,
      rawScore: 0,
      possiblePoints: 100,
      summary: 'We couldn’t reach that website.',
      findings: [
        {
          id: 'availability',
          label: 'Homepage availability',
          bucket: 'specialist',
          detail: `We couldn’t reach your website: ${reason}. This may be a hosting, DNS, or domain issue.`,
        },
      ],
      checksCompleted: 0,
      checksTotal: SCORED_CHECK_COUNT,
    })
    return
  }

  let linksEval: LinksEvaluation | null = null
  if (fetchResult.status >= 200 && fetchResult.status < 400) {
    linksEval = await evaluateHomepageLinks(fetchResult.html, fetchResult.finalUrl)
  }

  const { score, rawScore, possiblePoints, findings, checksCompleted, checksTotal } = buildReport(fetchResult, linksEval)

  const response: CheckResponse = {
    ok: true,
    input: normalized.toString(),
    finalUrl: fetchResult.finalUrl,
    score,
    rawScore,
    possiblePoints,
    summary: summaryFor(score, findings.some((f) => f.bucket === 'improve'), checksCompleted, checksTotal),
    findings: findings.map(({ id, label, bucket, detail }): Finding => ({ id, label, bucket, detail })),
    checksCompleted,
    checksTotal,
  }
  res.status(200).json(response)
}
