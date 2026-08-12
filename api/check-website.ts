// Vercel serverless function: POST /api/check-website
// Performs a small set of friendly, non-technical website health checks.
// Nothing submitted here is stored — the result is computed and returned
// in a single request/response cycle.

import { normalizeWebsiteUrl, hasExplicitProtocol, summaryFor, unscoredSummaryFor, CHECK_WEIGHTS, TITLE_MIN_LENGTH, META_DESCRIPTION_MIN_LENGTH } from '../src/lib/websiteCheck.js'
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

/** Thrown ONLY when no HTTP response was ever received for a hop —
 *  connection refused, TLS handshake/negotiation failure, DNS failure,
 *  or a timeout before any response arrived. Every OTHER safeFetchHtml
 *  failure (an unsafe redirect target, a malformed/missing redirect
 *  destination, too many redirects) happens only AFTER a real response
 *  (the redirect itself) was already received, and stays a plain Error.
 *  This distinction is what makes the HTTPS→HTTP fallback in
 *  handleCheckWebsite both safe and general: it can only ever trigger
 *  when HTTPS never got a response at all — never merely because of a
 *  real status code (404/500 never throws in the first place) and never
 *  because of a redirect-handling problem on an HTTPS connection that
 *  DID succeed. */
class PreResponseNetworkError extends Error {}

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
        throw new PreResponseNetworkError('The website took too long to respond.')
      }
      throw new PreResponseNetworkError('The website couldn’t be reached.')
    }
    clearTimeout(timer)

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) throw new Error('The website tried to redirect visitors, but didn’t say where to.')
      let next: URL
      try {
        next = new URL(location, current)
      } catch {
        throw new Error('The website tried to redirect visitors to an address we couldn’t understand.')
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

  throw new Error('The website kept redirecting without ever finishing, so we stopped checking.')
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

/** `httpsConnectionFailed` is set only by the HTTPS→HTTP fallback path in
 *  handleCheckWebsite: HTTPS wasn't merely unused or unenforced, it was
 *  actively tried and failed to connect at all — stronger, more specific
 *  evidence than the ordinary "doesn't appear to use HTTPS" case (e.g. a
 *  site the user pointed at plain http:// directly, or one whose HTTPS
 *  simply isn't the default). Wording reflects that difference; nothing
 *  else about scoring changes — this is still 0/25, 'improve', same as
 *  before. */
function httpsFinding(usedHttps: boolean, redirected: boolean, httpsConnectionFailed: boolean = false): Finding {
  if (usedHttps) {
    return {
      id: 'https',
      label: 'HTTPS / secure connection',
      bucket: 'good',
      detail: redirected
        ? 'Your website automatically sends visitors to a secure (HTTPS) connection, which protects information traveling between a visitor’s browser and your site — for example, anything typed into a form.'
        : 'Your website loads over a secure (HTTPS) connection, which protects information traveling between a visitor’s browser and your site — for example, anything typed into a form.',
      points: CHECK_WEIGHTS.https,
    }
  }
  if (httpsConnectionFailed) {
    return {
      id: 'https',
      label: 'HTTPS / secure connection',
      bucket: 'improve',
      detail:
        'We tried to open your website securely (HTTPS) and couldn’t connect at all, so this check used a plain, unsecured connection instead. Right now, information traveling between visitors’ browsers and your site — like anything typed into a form — isn’t protected. Adding a secure connection is strongly recommended; most hosting providers offer this for free.',
      points: 0,
    }
  }
  return {
    id: 'https',
    label: 'HTTPS / secure connection',
    bucket: 'improve',
    detail:
      'Your website doesn’t appear to use a secure (HTTPS) connection, which normally protects information traveling between a visitor’s browser and your site. Most hosting providers offer this for free — it’s worth asking about.',
    points: 0,
  }
}

function buildReport(fetchResult: FetchResult, linksEval: LinksEvaluation | null, httpsConnectionFailed: boolean = false): BuildReportResult {
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
        detail: `When we tried to open your homepage, it didn’t load normally — the server sent back an error instead (technical code: ${status}). This usually means the page can’t be found, or something went wrong on the server. It’s worth checking with whoever hosts your website, or confirming the address is correct.`,
        points: 0,
      },
      httpsFinding(usedHttps, fetchResult.redirected, httpsConnectionFailed),
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
    detail: 'Your homepage opened normally when we checked it — visitors should be able to reach it without a problem.',
    points: CHECK_WEIGHTS.availability,
  })

  // Response time — informational only, not scored. Plain-language
  // release: a genuinely sub-0.1s response used to round down to "about
  // 0.0 seconds," which reads as a display bug, not a real measurement —
  // "under 0.1 seconds" says the same true thing without looking broken.
  const responseTimeText = elapsedMs < 100 ? 'under 0.1 seconds' : `about ${(elapsedMs / 1000).toFixed(1)} seconds`
  if (elapsedMs < 2500) {
    findings.push({
      id: 'response-time',
      label: 'Response time',
      bucket: 'good',
      detail: `Your homepage started responding in ${responseTimeText}, a reasonable speed for visitors. This measures how quickly your site begins to load, not the complete page.`,
      points: 0,
    })
  } else {
    findings.push({
      id: 'response-time',
      label: 'Response time',
      bucket: 'improve',
      detail: `Your homepage took ${responseTimeText} to start responding. This is a quick, rough measurement, not a full speed test — but a slow start can lead some visitors to leave before the page even loads.`,
      points: 0,
    })
  }

  // HTTPS (25 pts)
  const https = httpsFinding(usedHttps, fetchResult.redirected, httpsConnectionFailed)
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
      detail:
        'Your site includes the basic setting needed to size your page for phones and tablets (sometimes called a viewport tag). This is a technical basic, not a full check of how your site actually looks or works on mobile — see the Visual & Usability Review below for that.',
      points: CHECK_WEIGHTS.mobile,
    })
  } else {
    findings.push({
      id: 'mobile',
      label: 'Mobile setup',
      bucket: 'improve',
      detail:
        'We didn’t find the basic setting that tells phones and tablets how to size your page (sometimes called a viewport tag). Without it, your site may appear zoomed out or be awkward to use on a phone.',
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
      detail:
        'Your homepage has a page title — the text shown in a browser tab, and often the clickable headline for your page in search results — and it’s long enough to meet this check’s basic guideline.',
      points: CHECK_WEIGHTS.title,
    })
  } else if (title) {
    score += 5
    findings.push({
      id: 'title',
      label: 'Page title',
      bucket: 'improve',
      detail:
        'Your homepage has a page title — the text shown in a browser tab, and often the clickable headline for your page in search results — but it’s quite short. A clearer, more descriptive title can help visitors know what the page is about before they click.',
      points: 5,
    })
  } else {
    findings.push({
      id: 'title',
      label: 'Page title',
      bucket: 'improve',
      detail:
        'No page title was found. A page title is the text shown in a browser tab, and it often becomes the clickable headline for your page in search results — without one, it may be less clear to visitors what the page is about.',
      points: 0,
    })
  }

  // Search-result description (10 pts) — same threshold-is-not-quality
  // framing as title. Plain-language release: wording for the "not
  // found" case is specified verbatim (label, primary message, and
  // explanation) — see the comment on CHECK_LABELS['meta-description']
  // in websiteCheck.ts. It deliberately never implies a missing
  // description prevents the business from appearing in search results
  // at all, and never promises higher rankings from adding one.
  const description = findMetaContent(html, 'description')
  if (description && description.length >= META_DESCRIPTION_MIN_LENGTH) {
    score += CHECK_WEIGHTS['meta-description']
    findings.push({
      id: 'meta-description',
      label: 'Search-result description',
      bucket: 'good',
      detail:
        'Your homepage has a search-result description long enough to meet this check’s basic guideline. This is the summary text search engines often show beneath your page’s title in search results, and it can help potential customers understand what you offer before they click. This is commonly called a meta description.',
      points: CHECK_WEIGHTS['meta-description'],
    })
  } else if (description) {
    score += 5
    findings.push({
      id: 'meta-description',
      label: 'Search-result description',
      bucket: 'improve',
      detail:
        'Your homepage has a search-result description, but it’s quite short. A fuller description can help potential customers understand what you offer and decide whether to visit your website. It does not guarantee higher search rankings. This is commonly called a meta description.',
      points: 5,
    })
  } else {
    findings.push({
      id: 'meta-description',
      label: 'Search-result description',
      bucket: 'improve',
      detail:
        'No search-result description was found. Search engines may create one automatically using text from your homepage, but it may not describe your business as clearly as you would like. Adding a concise description can help potential customers understand what you offer and decide whether to visit your website. It does not guarantee higher search rankings. This is commonly called a meta description.',
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
      detail:
        'Your homepage’s main content didn’t load in a way this automated check could read directly, so we couldn’t confirm whether contact information is there. That doesn’t necessarily mean anything is missing — some websites build their pages in a way simple automated tools can’t see into.',
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
        ? 'Your homepage’s main content didn’t load in a way this automated check could read directly, so we couldn’t find enough links to test. That doesn’t necessarily mean anything is wrong — some websites build their pages in a way simple automated tools can’t see into.'
        : 'We didn’t find enough links on your homepage to test a sample.',
      points: 0,
    })
  } else {
    score += linksEval.points
    findings.push({ ...linksEval.finding, points: linksEval.points })
  }

  // Ecommerce / marketplace scope signal — informational only, never scored.
  // Wording is deliberately conservative: hasEcommerceSignal() detects
  // platform code (e.g. WooCommerce CSS classes), which can be present
  // from a theme or plugin even on a site that never sells anything
  // online — so the message describes the software signal found, not a
  // claim about what the business is or what the page "looks like".
  if (hasEcommerceSignal(html, fetchResult.finalUrl)) {
    findings.push({
      id: 'ecommerce',
      label: 'Ecommerce software detected',
      bucket: 'specialist',
      detail:
        'We found signs that this website may use ecommerce software or features (such as WooCommerce or a similar platform). This can happen even on a site that doesn’t sell anything online — for example, when a theme or plugin includes it by default. If you do sell products or manage an online store, your website platform provider or an ecommerce specialist may be the best resource for store-specific areas like product listings, checkout, inventory, shipping, or payments.',
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
        detail: `We weren’t able to finish checking your website: ${reason} This may be temporary, a limitation of this automated checker, or a connection issue — it doesn’t necessarily mean your website is down. It’s worth trying again in a few minutes.`,
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
  //
  // Protocol-fallback release: when the user never chose a protocol
  // themselves (normalizeWebsiteUrl defaulted to https) and HTTPS fails
  // with a PreResponseNetworkError specifically — a connection, TLS, or
  // protocol-negotiation failure, never a real status code and never a
  // redirect-handling problem on a connection that DID succeed — the
  // exact same validated hostname is retried once over plain HTTP,
  // through the identical safety boundary (assertSafeUrl + safeFetchHtml's
  // own per-hop re-validation). A site with no working HTTPS at all
  // (like the scarservices.com case this fixes) previously came back as
  // a flat "couldn't be reached," even though it was reachable — just
  // not securely. An explicit http:// or https:// the user typed
  // themselves is never second-guessed here.
  let fetchResult: FetchResult
  let httpsConnectionFailed = false
  try {
    fetchResult = await safeFetchHtml(normalized, deps, timeoutMs)
  } catch (err) {
    const canRetryOverHttp = err instanceof PreResponseNetworkError && normalized.protocol === 'https:' && !hasExplicitProtocol(rawUrl)
    if (!canRetryOverHttp) {
      const reason = ((err as Error).message || 'An unknown error occurred.').replace(/\.*$/, '.')
      res.status(200).json(checkerUnavailableResponse(normalized.toString(), normalized.toString(), reason))
      return
    }

    const httpUrl = new URL(normalized.toString())
    httpUrl.protocol = 'http:'
    try {
      await assertSafeUrl(httpUrl, deps)
      fetchResult = await safeFetchHtml(httpUrl, deps, timeoutMs)
      httpsConnectionFailed = true
    } catch {
      // Neither protocol worked — an honest unverified/no-score result,
      // same shape as any other total failure.
      res.status(200).json(
        checkerUnavailableResponse(
          normalized.toString(),
          normalized.toString(),
          'The website couldn’t be reached over a secure (HTTPS) or a plain (HTTP) connection.'
        )
      )
      return
    }
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

    const report = buildReport(fetchResult, linksEval, httpsConnectionFailed)

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
