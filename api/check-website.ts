// Vercel serverless function: POST /api/check-website
// Performs a small set of friendly, non-technical website health checks.
// Nothing submitted here is stored — the result is computed and returned
// in a single request/response cycle.

import { normalizeWebsiteUrl, summaryFor, unscoredSummaryFor, CHECK_WEIGHTS, TITLE_MIN_LENGTH, META_DESCRIPTION_MIN_LENGTH } from '../src/lib/websiteCheck.js'
import type { Finding, CheckResponse } from '../src/lib/websiteCheck.js'
import {
  assertSafeUrl,
  UnsafeUrlError,
  evaluateContactSignal,
  evaluateHomepageLinks,
  type LinksEvaluation,
  type ContactLinksDeps,
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

/** Follows redirects manually so every hop can be safety-checked before being followed.
 *  `deps`/`timeoutMs` are test-only (see ContactLinksDeps) — production
 *  never supplies them; the real safety boundary and the real 8s timeout
 *  apply. Letting tests inject BOTH is what makes it possible to exercise
 *  a genuine timeout/connection-failure/DNS-failure end-to-end against a
 *  real local fixture server, in real bounded time, rather than mocking
 *  the failure or waiting out the real production timeout. */
async function safeFetchHtml(startUrl: URL, deps: ContactLinksDeps = {}, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<FetchResult> {
  let current = startUrl
  let redirected = false
  const started = Date.now()

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertSafeUrl(current, deps)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
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
// Per-check point weights now live in ../src/lib/websiteCheck.js's
// CHECK_WEIGHTS — the single source of truth also read by CheckPage.tsx's
// score explanation disclosure. Values below are unchanged from before
// that extraction; this only stops inlining them as magic numbers.
const SCORED_CHECK_COUNT = 7 // availability, https, mobile, title, meta-description, contact, links

type BuildReportResult =
  | { status: 'scored'; score: number; rawScore: number; possiblePoints: number; findings: Finding[]; checksCompleted: number; checksTotal: number }
  // Rubric-audit release: availability wasn't confirmed good — see the
  // CheckScored/CheckUnscored comment in websiteCheck.ts for why no
  // score is computed at all here, rather than a renormalized or
  // unrenormalized number that would overstate how much was checked.
  | { status: 'unscored'; findings: Finding[]; checksCompleted: number; checksTotal: number }

function httpsFinding(usedHttps: boolean, redirected: boolean): Finding {
  if (usedHttps) {
    return {
      id: 'https',
      label: 'HTTPS / secure connection',
      bucket: 'good',
      detail: redirected
        ? 'Your website redirects visitors to a secure (HTTPS) connection.'
        : 'Your website loads over a secure (HTTPS) connection.',
      points: CHECK_WEIGHTS.https,
    }
  }
  return {
    id: 'https',
    label: 'HTTPS / secure connection',
    bucket: 'improve',
    detail: 'Your website doesn’t appear to use a secure (HTTPS) connection. Most hosting providers offer free SSL certificates to enable this.',
    points: 0,
  }
}

function buildReport(fetchResult: FetchResult, linksEval: LinksEvaluation | null): BuildReportResult {
  const { html, elapsedMs, usedHttps, status } = fetchResult
  const available = status >= 200 && status < 400

  if (!available) {
    // A real HTTP response came back — genuine evidence about THIS
    // request — but it wasn't a success status, so every content check
    // (mobile/title/meta/contact/links) is skipped: there's no usable
    // homepage to inspect. Only 2 of 7 checks were ever attempted, which
    // is below this tool's bar for showing an aggregate score (see the
    // CheckScored/CheckUnscored comment in websiteCheck.ts) — the real
    // status and whatever HTTPS evidence exists are still reported
    // individually, honestly, just without a misleading single number.
    const findings: Finding[] = [
      {
        id: 'availability',
        label: 'Homepage availability',
        bucket: 'specialist',
        detail: `Your homepage responded with a status of ${status} instead of a normal success status. This usually means the page couldn’t be found or the server encountered an error — worth checking with your host, or confirming the address is correct.`,
        points: 0,
      },
      httpsFinding(usedHttps, fetchResult.redirected),
    ]
    return { status: 'unscored', findings, checksCompleted: 2, checksTotal: SCORED_CHECK_COUNT }
  }

  const findings: Finding[] = []
  let score = 0
  let possiblePoints = 100
  let checksCompleted = SCORED_CHECK_COUNT

  // Availability (30 pts) — confirmed good, since we only reach here when available.
  score += CHECK_WEIGHTS.availability
  findings.push({
    id: 'availability',
    label: 'Homepage availability',
    bucket: 'good',
    detail: 'Your homepage loaded successfully.',
    points: CHECK_WEIGHTS.availability,
  })

  // Response time — informational only, not scored
  const seconds = (elapsedMs / 1000).toFixed(1)
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

  // HTTPS (25 pts)
  const https = httpsFinding(usedHttps, fetchResult.redirected)
  if (usedHttps) score += CHECK_WEIGHTS.https
  findings.push(https)

  // Mobile viewport (15 pts) — the tag's presence only. Wording claims
  // exactly that, not a verified good visual display on real devices
  // (that's what the separate Visual & Usability Review actually measures).
  const hasViewport = /<meta\s+[^>]*name\s*=\s*["']viewport["']/i.test(html)
  if (hasViewport) {
    score += CHECK_WEIGHTS.mobile
    findings.push({
      id: 'mobile',
      label: 'Mobile setup',
      bucket: 'good',
      detail: 'Your site includes a mobile viewport tag — the basic technical setup for displaying properly on phones and tablets.',
      points: CHECK_WEIGHTS.mobile,
    })
  } else {
    findings.push({
      id: 'mobile',
      label: 'Mobile setup',
      bucket: 'improve',
      detail: 'No mobile viewport tag was found. Without it, your site may look zoomed-out or hard to use on phones.',
      points: 0,
    })
  }

  // Page title (10 pts) — TITLE_MIN_LENGTH is this tool's own coarse
  // cutoff, not a guarantee of quality; wording says only what the
  // check actually measured (length), not "descriptive."
  const title = extractTitle(html)
  if (title && title.length >= TITLE_MIN_LENGTH) {
    score += CHECK_WEIGHTS.title
    findings.push({
      id: 'title',
      label: 'Page title',
      bucket: 'good',
      detail: 'Your homepage has a page title that meets this check’s basic length threshold.',
      points: CHECK_WEIGHTS.title,
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

  // Meta description (10 pts) — same threshold-is-not-quality framing as title.
  const description = findMetaContent(html, 'description')
  if (description && description.length >= META_DESCRIPTION_MIN_LENGTH) {
    score += CHECK_WEIGHTS['meta-description']
    findings.push({
      id: 'meta-description',
      label: 'Meta description',
      bucket: 'good',
      detail: 'Your homepage has a meta description that meets this check’s basic length threshold.',
      points: CHECK_WEIGHTS['meta-description'],
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
    possiblePoints -= CHECK_WEIGHTS.contact
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
    possiblePoints -= CHECK_WEIGHTS.links
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

  const finalScore = possiblePoints > 0 ? Math.round((score / possiblePoints) * 100) : 0
  return {
    status: 'scored',
    score: Math.max(0, Math.min(100, finalScore)),
    rawScore: score,
    possiblePoints,
    findings,
    checksCompleted,
    checksTotal: SCORED_CHECK_COUNT,
  }
}

// summaryFor/unscoredSummaryFor now live in ../src/lib/websiteCheck.js —
// shared with the client-side rendered-fallback merge
// (technicalFallbackMerge.ts), so there is exactly one summary
// calculation per state, not two that could disagree about the same
// final findings.

/** Shared shape for BOTH ways this checker can fail to complete at all:
 *  a pre-fetch exception (DNS/timeout/connection/redirect-chain — see
 *  safeFetchHtml) and a post-fetch exception (an unexpected failure in
 *  evaluateHomepageLinks/buildReport themselves). Neither is confirmed
 *  evidence the website doesn't work — only that this attempt didn't
 *  succeed — so this is always 'unverified'/0-of-7/no-score, never a
 *  fabricated failure. `reason` must already be safe to show verbatim
 *  (never a raw caught error's own message for the post-fetch case —
 *  see its call site). */
export function checkerUnavailableResponse(input: string, finalUrl: string, reason: string): CheckResponse {
  return {
    ok: true,
    status: 'unscored',
    input,
    finalUrl,
    summary: unscoredSummaryFor('checker-unavailable', 0, SCORED_CHECK_COUNT),
    findings: [
      {
        id: 'availability',
        label: 'Homepage availability',
        bucket: 'unverified',
        detail: `We weren’t able to complete this check for your website: ${reason} This may be temporary, a limitation of this automated checker, or an issue on our end — it doesn’t necessarily mean your website is down. Please try again in a few minutes.`,
        points: 0,
      },
    ],
    checksCompleted: 0,
    checksTotal: SCORED_CHECK_COUNT,
  }
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

/**
 * The routed handler's real logic. Takes optional `deps`/`timeoutMs` —
 * unused in production (the default export below never supplies them)
 * — so tests can point the exact same request/response path at a real
 * local fixture server (via contactLinksCheck.ts's own ContactLinksDeps
 * DNS/classification/allowedPorts injection, the same pattern
 * api/check-visual.ts's handleCheckVisual already uses) and a fast,
 * real, bounded timeout, instead of mocking failures or waiting out the
 * real production timeout. Mirrors api/check-visual.ts exactly.
 */
export async function handleCheckWebsite(req: VercelRequest, res: VercelResponse, deps: ContactLinksDeps = {}, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<void> {
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
    await assertSafeUrl(normalized, deps)
  } catch (err) {
    const message = err instanceof UnsafeUrlError ? err.message : 'That website address isn’t supported.'
    res.status(400).json({ ok: false, error: message })
    return
  }

  // Pre-fetch failure (DNS/timeout/connection/redirect-chain — see
  // safeFetchHtml): we never received a response at all, so this is
  // never confirmed evidence the website is broken — only that this
  // attempt didn't succeed. safeFetchHtml's own thrown messages are
  // already safe to show verbatim (no internals/stack traces).
  let fetchResult: FetchResult
  try {
    fetchResult = await safeFetchHtml(normalized, deps, timeoutMs)
  } catch (err) {
    const reason = ((err as Error).message || 'An unknown error occurred.').replace(/\.*$/, '.')
    res.status(200).json(checkerUnavailableResponse(normalized.toString(), normalized.toString(), reason))
    return
  }

  // Post-fetch failure: an unexpected exception in evaluateHomepageLinks
  // or buildReport itself (not a normal, already-handled outcome — those
  // never throw). This must not surface as a raw 500 (which the client
  // can only show as a generic connection error) nor silently produce a
  // misleading result — it gets the SAME honest "unable to complete,
  // 0 of 7, no score" shape as a pre-fetch failure. The reason shown is
  // deliberately generic, never the caught error's own message, so no
  // internal detail is ever exposed.
  try {
    let linksEval: LinksEvaluation | null = null
    if (fetchResult.status >= 200 && fetchResult.status < 400) {
      linksEval = await evaluateHomepageLinks(fetchResult.html, fetchResult.finalUrl, deps)
    }

    const report = buildReport(fetchResult, linksEval)

    const response: CheckResponse =
      report.status === 'scored'
        ? {
            ok: true,
            status: 'scored',
            input: normalized.toString(),
            finalUrl: fetchResult.finalUrl,
            score: report.score,
            rawScore: report.rawScore,
            possiblePoints: report.possiblePoints,
            summary: summaryFor(report.score, report.findings.some((f) => f.bucket === 'improve'), report.checksCompleted, report.checksTotal),
            findings: report.findings.map(({ id, label, bucket, detail, points }): Finding => ({ id, label, bucket, detail, points })),
            checksCompleted: report.checksCompleted,
            checksTotal: report.checksTotal,
          }
        : {
            ok: true,
            status: 'unscored',
            input: normalized.toString(),
            finalUrl: fetchResult.finalUrl,
            summary: unscoredSummaryFor('confirmed-error-response', report.checksCompleted, report.checksTotal),
            findings: report.findings.map(({ id, label, bucket, detail, points }): Finding => ({ id, label, bucket, detail, points })),
            checksCompleted: report.checksCompleted,
            checksTotal: report.checksTotal,
          }

    res.status(200).json(response)
  } catch {
    res.status(200).json(checkerUnavailableResponse(normalized.toString(), fetchResult.finalUrl, 'An unexpected error occurred while finishing this check.'))
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  return handleCheckWebsite(req, res)
}
