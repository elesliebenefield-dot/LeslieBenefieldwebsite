// Server-only (Node: dns/promises, fetch) shared logic for the
// Technical Basics 'contact' and 'links' checks. Extracted verbatim from
// api/check-website.ts (release-polish pass) so the SAME detection,
// safety-boundary, and scoring logic can be reused by the rendered-DOM
// fallback (api/check-visual.ts) for pages the static check couldn't
// verify because they appear to require JavaScript rendering — without
// duplicating any of it. Never imported by CheckPage.tsx or any other
// browser bundle: this uses node:dns, unlike src/lib/websiteCheck.ts,
// which deliberately stays DOM/browser-safe.

import { lookup } from 'node:dns/promises'
import type { Finding } from './websiteCheck.js'

export class UnsafeUrlError extends Error {}

// ─── SSRF-safe URL validation (identical to the pre-existing check in
// api/check-website.ts — moved, not reimplemented) ──────────────────
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

/** Test-only override surface, matching the exact same shape/precedent
 *  as src/lib/pipeline/capture/networkSafety.ts's own UrlSafetyDeps —
 *  lets tests point a fixture hostname/port at a real local server
 *  (which can't realistically bind to 80/443 or resolve to a public
 *  IP) without touching real DNS or weakening the real, unmodified
 *  checks any production caller gets. Production (api/check-website.ts)
 *  never supplies this. */
export interface ContactLinksDeps {
  lookup?: (hostname: string) => Promise<{ address: string }[]>
  classify?: (ip: string) => boolean
  allowedPorts?: readonly string[]
}

/** Validates protocol/port/hostname and resolves DNS, rejecting anything private or internal. */
export async function assertSafeUrl(url: URL, deps: ContactLinksDeps = {}): Promise<void> {
  const doLookup = deps.lookup ?? ((hostname: string) => lookup(hostname, { all: true }))
  const classify = deps.classify ?? isPrivateIp
  const allowedPorts = deps.allowedPorts ?? ['80', '443']

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('Only public http:// and https:// addresses are supported.')
  }

  const hostname = url.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new UnsafeUrlError('Local or internal addresses can’t be checked.')
  }

  if (url.port && !allowedPorts.includes(url.port)) {
    throw new UnsafeUrlError('Only standard web ports (80/443) are supported.')
  }

  const literalIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
  if (literalIpv4) {
    if (classify(hostname)) throw new UnsafeUrlError('That address points to a private or internal network.')
    return
  }
  if (hostname.includes(':')) {
    if (classify(hostname)) throw new UnsafeUrlError('That address points to a private or internal network.')
    return
  }

  let addresses: { address: string }[]
  try {
    addresses = await doLookup(hostname)
  } catch {
    throw new UnsafeUrlError('That website address couldn’t be found.')
  }
  if (addresses.length === 0 || addresses.some((a) => classify(a.address))) {
    throw new UnsafeUrlError('That address points to a private or internal network.')
  }
}

// ─── Contact-signal detection (identical to the pre-existing check in
// api/check-website.ts) — recognizes visible phone numbers, visible
// email addresses, mailto: links, and clearly-labeled contact links.
// Works on ANY HTML string: a static fetch's raw HTML, or a rendered
// page's outerHTML — the caller decides which. ─────────────────────
export function hasContactSignal(html: string): boolean {
  const text = html.replace(/<[^>]+>/g, ' ')
  const phonePattern = /(\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  const mailtoPattern = /href\s*=\s*["']mailto:/i
  const contactLinkPattern = /<a\s+[^>]*(?:href=["'][^"']*contact[^"']*["']|>[^<]*contact[^<]*<)/i
  return phonePattern.test(text) || emailPattern.test(text) || mailtoPattern.test(html) || contactLinkPattern.test(html)
}

// ─── Homepage-link extraction/sampling/checking (identical to the
// pre-existing checks in api/check-website.ts) — mailto:/tel:/
// javascript: and fragment-only hrefs are excluded by construction (the
// href capture regex below excludes leading '#', and the scheme check
// rejects the rest); only http:/https: candidates ever reach
// sampleLinks/checkLink. Works on any HTML string, same as
// hasContactSignal above. ─────────────────────────────────────────
export function extractLinks(html: string, baseUrl: string): URL[] {
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

export const MAX_LINKS_CHECKED = 6

export function sampleLinks(links: URL[], baseHostname: string): URL[] {
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

const LINK_TIMEOUT_MS = 3500
const MAX_LINK_REDIRECTS = 3
const USER_AGENT = 'WebsitesByLeslie-Checkup/1.0 (+https://websitesbyleslie.com)'

/** Same manual, per-hop-validated redirect handling as check-website.ts's
 *  own safeFetchHtml, but status-only. Every hop goes through
 *  assertSafeUrl — no link candidate, static or rendered, ever bypasses
 *  this. `deps` is test-only (see ContactLinksDeps); production never
 *  supplies it. */
export async function checkLink(startUrl: URL, deps: ContactLinksDeps = {}): Promise<boolean> {
  let current = startUrl

  for (let hop = 0; hop <= MAX_LINK_REDIRECTS; hop++) {
    try {
      await assertSafeUrl(current, deps)
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

// ─── Reusable evaluation: given ANY html string (static-fetched or
// rendered) plus the page's final URL, produce the exact same 'contact'/
// 'links' Finding + points api/check-website.ts's buildReport already
// produces for the static path. Called from there for the static case,
// and from api/check-visual.ts's fallback for the rendered case — one
// implementation, two evidence sources. ──────────────────────────────

export const CONTACT_POINTS = 5
export const LINKS_POINTS = 5

export interface ContactEvaluation {
  found: boolean
  finding: Finding
  points: number
}

export function evaluateContactSignal(html: string): ContactEvaluation {
  if (hasContactSignal(html)) {
    return {
      found: true,
      points: CONTACT_POINTS,
      finding: {
        id: 'contact',
        label: 'Contact information',
        bucket: 'good',
        detail: 'We found what appears to be contact information (a phone number, email address, or contact link) on your homepage.',
      },
    }
  }
  return {
    found: false,
    points: 0,
    finding: {
      id: 'contact',
      label: 'Contact information',
      bucket: 'improve',
      detail: 'We couldn’t clearly find contact information on your homepage. Visible contact details help build trust with visitors.',
    },
  }
}

export interface LinksEvaluation {
  linksChecked: number
  brokenLinks: number
  finding: Finding
  points: number
}

/** `null` means "still not enough evidence" (no safe http:/https: link
 *  candidates found) — the caller keeps its existing 'unverified' result
 *  rather than fabricating a pass; there is no confirmed-zero-links
 *  "improve" case in the existing design (unlike contact, which does
 *  have one — see evaluateContactSignal above). `deps` is test-only
 *  (see ContactLinksDeps); production never supplies it. */
export async function evaluateHomepageLinks(html: string, finalUrl: string, deps: ContactLinksDeps = {}): Promise<LinksEvaluation | null> {
  const links = extractLinks(html, finalUrl)
  const finalHostname = new URL(finalUrl).hostname
  const sample = sampleLinks(links, finalHostname)
  const linksChecked = sample.length
  if (linksChecked === 0) return null

  const results = await Promise.all(sample.map((l) => checkLink(l, deps)))
  const brokenLinks = results.filter((ok) => !ok).length
  const working = linksChecked - brokenLinks
  const points = Math.round(LINKS_POINTS * (working / linksChecked))

  const finding: Finding =
    brokenLinks === 0
      ? {
          id: 'links',
          label: 'Homepage links',
          bucket: 'good',
          detail: `We checked a sample of ${linksChecked} link${linksChecked === 1 ? '' : 's'} from your homepage and all of them loaded fine. This is a sample, not a full site crawl.`,
        }
      : {
          id: 'links',
          label: 'Homepage links',
          bucket: 'improve',
          detail: `We checked a sample of ${linksChecked} link${linksChecked === 1 ? '' : 's'} from your homepage, and ${brokenLinks} may be broken or slow to respond. This is a sample, not a full site crawl.`,
        }

  return { linksChecked, brokenLinks, finding, points }
}
