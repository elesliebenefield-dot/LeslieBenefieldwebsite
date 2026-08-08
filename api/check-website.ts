// Vercel serverless function: POST /api/check-website
// Performs a small set of friendly, non-technical website health checks.
// Nothing submitted here is stored — the result is computed and returned
// in a single request/response cycle.

import { lookup } from 'node:dns/promises'
import { normalizeWebsiteUrl } from '../src/lib/websiteCheck'
import type { Finding, CheckResponse } from '../src/lib/websiteCheck'

// ─── Safety limits ──────────────────────────────────────────────
const REQUEST_TIMEOUT_MS = 8000
const LINK_TIMEOUT_MS = 3500
const MAX_RESPONSE_BYTES = 2_000_000 // 2 MB of HTML is far more than we need
const MAX_REDIRECTS = 5
const MAX_LINKS_CHECKED = 6
const USER_AGENT = 'WebsitesByLeslie-Checkup/1.0 (+https://websitesbyleslie.com)'

class UnsafeUrlError extends Error {}

// ─── SSRF-safe URL validation ───────────────────────────────────
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

function inRange(int: number, base: string, bits: number): boolean {
  const baseInt = ipv4ToInt(base)
  if (baseInt === null) return false
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (int & mask) === (baseInt & mask)
}

function isPrivateIPv4(ip: string): boolean {
  const int = ipv4ToInt(ip)
  if (int === null) return true // unparsable — treat as unsafe
  const blocked: Array<[string, number]> = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
  ]
  return blocked.some(([base, bits]) => inRange(int, base, bits))
}

function isPrivateIPv6(ip: string): boolean {
  // Node's URL.hostname keeps brackets around IPv6 literals (e.g. "[::1]") — strip them before comparing.
  const normalized = ip.toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
  if (normalized === '::1' || normalized === '::') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true // fc00::/7 ULA
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true // fe80::/10 link-local
  }
  // IPv4-mapped IPv6, dotted form (::ffff:a.b.c.d) — check the embedded IPv4 address
  const mappedDotted = normalized.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (mappedDotted) return isPrivateIPv4(mappedDotted[1])

  // IPv4-mapped IPv6, canonical hex-group form (::ffff:7f00:1) — Node's URL parser
  // normalizes ::ffff:127.0.0.1 to this form, so it must be checked too.
  const mappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16)
    const lo = parseInt(mappedHex[2], 16)
    const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
    return isPrivateIPv4(ipv4)
  }

  return false
}

function isPrivateIp(ip: string): boolean {
  return ip.includes(':') ? isPrivateIPv6(ip) : isPrivateIPv4(ip)
}

/** Validates protocol/port/hostname and resolves DNS, rejecting anything private or internal. */
async function assertSafeUrl(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('Only public http:// and https:// addresses are supported.')
  }

  const hostname = url.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new UnsafeUrlError('Local or internal addresses can’t be checked.')
  }

  if (url.port && url.port !== '80' && url.port !== '443') {
    throw new UnsafeUrlError('Only standard web ports (80/443) are supported.')
  }

  const literalIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
  if (literalIpv4) {
    if (isPrivateIPv4(hostname)) throw new UnsafeUrlError('That address points to a private or internal network.')
    return
  }
  if (hostname.includes(':')) {
    if (isPrivateIPv6(hostname)) throw new UnsafeUrlError('That address points to a private or internal network.')
    return
  }

  let addresses: { address: string }[]
  try {
    addresses = await lookup(hostname, { all: true })
  } catch {
    throw new UnsafeUrlError('That website address couldn’t be found.')
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
    throw new UnsafeUrlError('That address points to a private or internal network.')
  }
}

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

function hasContactSignal(html: string): boolean {
  const text = html.replace(/<[^>]+>/g, ' ')
  const phonePattern = /(\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  const mailtoPattern = /href\s*=\s*["']mailto:/i
  const contactLinkPattern = /<a\s+[^>]*(?:href=["'][^"']*contact[^"']*["']|>[^<]*contact[^<]*<)/i
  return (
    phonePattern.test(text) ||
    emailPattern.test(text) ||
    mailtoPattern.test(html) ||
    contactLinkPattern.test(html)
  )
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

function extractLinks(html: string, baseUrl: string): URL[] {
  const hrefs = Array.from(html.matchAll(/<a\s+[^>]*href\s*=\s*["']([^"'#][^"']*)["']/gi)).map((m) => m[1])
  const seen = new Set<string>()
  const links: URL[] = []
  for (const href of hrefs) {
    if (/^(mailto|tel|javascript):/i.test(href)) continue
    try {
      const resolved = new URL(href, baseUrl)
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') continue
      const key = resolved.toString()
      if (seen.has(key)) continue
      seen.add(key)
      links.push(resolved)
    } catch {
      // ignore malformed hrefs
    }
  }
  return links
}

function stripWww(hostname: string): string {
  return hostname.replace(/^www\./, '')
}

function sampleLinks(links: URL[], baseHostname: string): URL[] {
  const base = stripWww(baseHostname)
  const sameSite = links.filter((l) => stripWww(l.hostname) === base)
  const crossSite = links.filter((l) => stripWww(l.hostname) !== base)
  const sample = sameSite.slice(0, MAX_LINKS_CHECKED)
  if (sample.length < 3) {
    for (const link of crossSite) {
      if (sample.length >= MAX_LINKS_CHECKED) break
      sample.push(link)
    }
  }
  return sample.slice(0, MAX_LINKS_CHECKED)
}

const MAX_LINK_REDIRECTS = 3

/** Same manual, per-hop-validated redirect handling as safeFetchHtml, but status-only. */
async function checkLink(startUrl: URL): Promise<boolean> {
  let current = startUrl

  for (let hop = 0; hop <= MAX_LINK_REDIRECTS; hop++) {
    try {
      await assertSafeUrl(current)
    } catch {
      return false
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), LINK_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(current.toString(), {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': USER_AGENT },
      })
    } catch {
      return false
    } finally {
      clearTimeout(timer)
    }

    res.body?.cancel().catch(() => {})

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return false
      try {
        current = new URL(location, current)
      } catch {
        return false
      }
      continue
    }

    return res.status < 400
  }

  return false
}

// ─── Scoring ─────────────────────────────────────────────────────
interface ScoredFinding extends Finding {
  points: number
}

const SCORED_CHECK_COUNT = 7 // availability, https, mobile, title, meta-description, contact, links

interface ReportResult {
  score: number
  findings: Finding[]
  checksCompleted: number
  checksTotal: number
}

function buildReport(fetchResult: FetchResult, brokenLinks: number, linksChecked: number): ReportResult {
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
    if (hasContactSignal(html)) {
      score += 5
      findings.push({
        id: 'contact',
        label: 'Contact information',
        bucket: 'good',
        detail: 'We found what appears to be contact information (a phone number, email address, or contact link) on your homepage.',
        points: 5,
      })
    } else if (thinContent) {
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
      findings.push({
        id: 'contact',
        label: 'Contact information',
        bucket: 'improve',
        detail: 'We couldn’t clearly find contact information on your homepage. Visible contact details help build trust with visitors.',
        points: 0,
      })
    }

    // Broken links sample (5 pts) — if we found no usable links to sample, we genuinely
    // don't know whether that's because there are none or because they're rendered by
    // scripts we don't execute, so this is left unverified rather than assumed clean.
    if (linksChecked === 0) {
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
      const working = linksChecked - brokenLinks
      const points = Math.round(5 * (working / linksChecked))
      score += points
      if (brokenLinks === 0) {
        findings.push({
          id: 'links',
          label: 'Homepage links',
          bucket: 'good',
          detail: `We checked a sample of ${linksChecked} link${linksChecked === 1 ? '' : 's'} from your homepage and all of them loaded fine. This is a sample, not a full site crawl.`,
          points,
        })
      } else {
        findings.push({
          id: 'links',
          label: 'Homepage links',
          bucket: 'improve',
          detail: `We checked a sample of ${linksChecked} link${linksChecked === 1 ? '' : 's'} from your homepage, and ${brokenLinks} may be broken or slow to respond. This is a sample, not a full site crawl.`,
          points,
        })
      }
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
    findings,
    checksCompleted,
    checksTotal: SCORED_CHECK_COUNT,
  }
}

function summaryFor(score: number): string {
  if (score >= 85) return 'Your website is in great shape overall, with just a few small things worth a look.'
  if (score >= 65) return 'Your website is solid overall, with some room to improve.'
  if (score >= 40) return 'Your website is working, but a few common issues could be affecting visitors.'
  return 'We ran into some notable issues. A closer look would likely help.'
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

  let brokenLinks = 0
  let linksChecked = 0
  if (fetchResult.status >= 200 && fetchResult.status < 400) {
    const links = extractLinks(fetchResult.html, fetchResult.finalUrl)
    const finalHostname = new URL(fetchResult.finalUrl).hostname
    const sample = sampleLinks(links, finalHostname)
    linksChecked = sample.length
    if (linksChecked > 0) {
      const results = await Promise.all(sample.map((l) => checkLink(l)))
      brokenLinks = results.filter((ok) => !ok).length
    }
  }

  const { score, findings, checksCompleted, checksTotal } = buildReport(fetchResult, brokenLinks, linksChecked)

  const response: CheckResponse = {
    ok: true,
    input: normalized.toString(),
    finalUrl: fetchResult.finalUrl,
    score,
    summary: summaryFor(score),
    findings: findings.map(({ id, label, bucket, detail }): Finding => ({ id, label, bucket, detail })),
    checksCompleted,
    checksTotal,
  }
  res.status(200).json(response)
}
