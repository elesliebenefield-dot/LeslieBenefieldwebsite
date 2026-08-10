// Sub-patch 2d (practical scope reset, see patch.md's "Scope Reset —
// Practical Release Plan") — the network-safety core of the capture
// boundary: classifying IP addresses and validating candidate capture
// URLs/hostnames before ANY connection is attempted.
//
// This module never connects to anything itself — it only classifies and
// resolves (via node:dns). The actual connection-binding guarantee (no
// re-resolution between "we checked" and "we connect") lives in
// connectionBindingProxy.ts, which uses this module's resolved, validated
// addresses to connect directly by IP literal.
//
// Import boundary: this is a Node-only module (uses node:dns). It imports
// nothing from src/lib/pipeline/types/ because it is check-agnostic
// infrastructure, not evidence-shaped data — there is nothing here for a
// registered check's schema to correlate with.

import { lookup as defaultDnsLookup } from 'node:dns/promises'

/** Thin adapter so the injectable `deps.lookup` below has one exact,
 *  non-overloaded signature regardless of node:dns's own overload set. */
async function nodeDnsLookupAll(hostname: string, options: { all: true; verbatim: true }): Promise<{ address: string; family: number }[]> {
  const result = await defaultDnsLookup(hostname, options)
  return result
}

export type IpAddressClassification =
  | 'public'
  | 'unspecified'
  | 'loopback'
  | 'private'
  | 'link-local'
  | 'cloud-metadata'
  | 'reserved'
  | 'multicast'
  | 'unparsable'

export function isSafeClassification(c: IpAddressClassification): boolean {
  return c === 'public'
}

// ─── IPv4 ───────────────────────────────────────────────────────────────

/** Strict IPv4 dotted-quad: exactly 4 groups, each 1-3 digits, each group
 *  either "0" or with no leading zero (rejects "017"-style octal-looking
 *  groups), each numeric value 0-255. Anything that looks like an IP
 *  address but doesn't match this exactly (decimal-integer form,
 *  shortened dotted form, hex form, octal-leading-zero form) is treated
 *  as ambiguous and rejected outright by `classifyHostnameShape` below —
 *  never silently reinterpreted the way some resolvers/browsers do. */
const STRICT_IPV4_PATTERN = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/

function ipv4ToInt(ip: string): number | null {
  if (!STRICT_IPV4_PATTERN.test(ip)) return null
  const parts = ip.split('.').map(Number)
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

function inRange(int: number, base: string, bits: number): boolean {
  const baseInt = ipv4ToInt(base)
  if (baseInt === null) return false
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (int & mask) === (baseInt & mask)
}

/** Ordered so the first matching, most-specific classification wins
 *  (e.g. the single cloud-metadata address is checked before the broader
 *  link-local /16 it lives inside). */
const IPV4_RANGES: ReadonlyArray<[string, number, IpAddressClassification]> = [
  ['0.0.0.0', 32, 'unspecified'],
  ['0.0.0.0', 8, 'reserved'],
  ['127.0.0.0', 8, 'loopback'],
  ['169.254.169.254', 32, 'cloud-metadata'],
  ['169.254.0.0', 16, 'link-local'],
  ['10.0.0.0', 8, 'private'],
  ['172.16.0.0', 12, 'private'],
  ['192.168.0.0', 16, 'private'],
  ['100.64.0.0', 10, 'private'], // CGNAT — shared-address space, not publicly routable
  ['192.0.0.0', 24, 'reserved'], // IETF protocol assignments
  ['192.0.2.0', 24, 'reserved'], // TEST-NET-1
  ['198.18.0.0', 15, 'reserved'], // benchmarking
  ['198.51.100.0', 24, 'reserved'], // TEST-NET-2
  ['203.0.113.0', 24, 'reserved'], // TEST-NET-3
  ['224.0.0.0', 4, 'multicast'],
  ['240.0.0.0', 4, 'reserved'], // reserved for future use, includes 255.255.255.255 broadcast
]

export function classifyIpv4(ip: string): IpAddressClassification {
  const int = ipv4ToInt(ip)
  if (int === null) return 'unparsable'
  for (const [base, bits, classification] of IPV4_RANGES) {
    if (inRange(int, base, bits)) return classification
  }
  return 'public'
}

// ─── IPv6 ───────────────────────────────────────────────────────────────

/** Strips brackets (Node's URL.hostname keeps them, e.g. "[::1]") and a
 *  zone/scope ID ("fe80::1%eth0" -> "fe80::1") — a zone ID is only ever
 *  meaningful for link-local addresses anyway, so stripping it can only
 *  make classification MORE conservative, never less. */
function normalizeIpv6(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/%.*$/, '')
}

/**
 * Expands any valid textual IPv6 form (including "::" compression and an
 * embedded trailing IPv4 literal) into a single 128-bit integer, so range
 * membership can be checked by real bit-mask comparison — not string-
 * prefix guessing, which is easy to get subtly wrong for compressed
 * forms. Returns null for anything structurally invalid.
 */
function ipv6ToBigInt(normalized: string): bigint | null {
  let head = normalized
  let embeddedV4Groups: string[] | null = null

  const v4Match = normalized.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (v4Match) {
    if (!STRICT_IPV4_PATTERN.test(v4Match[1])) return null
    const parts = v4Match[1].split('.').map(Number)
    embeddedV4Groups = [(((parts[0] << 8) | parts[1]) >>> 0).toString(16), (((parts[2] << 8) | parts[3]) >>> 0).toString(16)]
    head = normalized.slice(0, normalized.length - v4Match[1].length).replace(/:$/, '')
    if (head === '') head = '::' // e.g. "::1.2.3.4" -> head becomes "::" after stripping
  }

  const halves = head.split('::')
  if (halves.length > 2) return null

  const parseGroups = (s: string): string[] => (s === '' ? [] : s.split(':'))
  const leftGroups = parseGroups(halves[0])
  let rightGroups = halves.length === 2 ? parseGroups(halves[1]) : []
  let effectiveLeft = leftGroups

  if (embeddedV4Groups) {
    if (halves.length === 2) rightGroups = [...rightGroups, ...embeddedV4Groups]
    else effectiveLeft = [...effectiveLeft, ...embeddedV4Groups]
  }

  const totalGiven = effectiveLeft.length + rightGroups.length
  let allGroups: string[]
  if (halves.length === 1) {
    if (totalGiven !== 8) return null
    allGroups = effectiveLeft
  } else {
    if (totalGiven > 8) return null
    const missing = 8 - totalGiven
    allGroups = [...effectiveLeft, ...Array<string>(missing).fill('0'), ...rightGroups]
  }

  if (allGroups.length !== 8) return null
  let result = 0n
  for (const g of allGroups) {
    if (g !== '0' && !/^[0-9a-f]{1,4}$/.test(g)) return null
    if (!/^[0-9a-f]{0,4}$/.test(g)) return null
    result = (result << 16n) | BigInt(parseInt(g || '0', 16))
  }
  return result
}

function ipv6InRange(addr: bigint, baseStr: string, prefixBits: number): boolean {
  const base = ipv6ToBigInt(baseStr)
  if (base === null) return false
  const shift = 128n - BigInt(prefixBits)
  const mask = prefixBits === 0 ? 0n : ((1n << BigInt(prefixBits)) - 1n) << shift
  return (addr & mask) === (base & mask)
}

/** Ordered so the first matching, most-specific classification wins. */
const IPV6_RANGES: ReadonlyArray<[string, number, IpAddressClassification]> = [
  ['::', 128, 'unspecified'],
  ['::1', 128, 'loopback'],
  ['100::', 64, 'reserved'], // discard-only
  ['2001:db8::', 32, 'reserved'], // documentation-only
  ['fc00::', 7, 'private'], // unique local (fc00::/7)
  ['fe80::', 10, 'link-local'],
  ['ff00::', 8, 'multicast'],
]

export function classifyIpv6(rawIp: string): IpAddressClassification {
  const ip = normalizeIpv6(rawIp)
  if (!/^[0-9a-f:.]+$/.test(ip)) return 'unparsable'

  // IPv4-mapped (::ffff:a.b.c.d, or its hex-group equivalent) and NAT64
  // (64:ff9b::a.b.c.d) — classify by the embedded IPv4 address, since
  // that's the address actually used on the wire.
  const mappedDotted = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (mappedDotted) return classifyIpv4(mappedDotted[1])
  const mappedHex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16)
    const lo = parseInt(mappedHex[2], 16)
    return classifyIpv4(`${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`)
  }
  const nat64 = ip.match(/^64:ff9b::(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (nat64) return classifyIpv4(nat64[1])

  const addr = ipv6ToBigInt(ip)
  if (addr === null) return 'unparsable'
  for (const [base, bits, classification] of IPV6_RANGES) {
    if (ipv6InRange(addr, base, bits)) return classification
  }
  return 'public'
}

export function classifyIpAddress(ip: string): IpAddressClassification {
  return ip.includes(':') ? classifyIpv6(ip) : classifyIpv4(ip)
}

// ─── Hostname shape — reject ambiguous/alternate numeric encodings ─────

/**
 * A hostname string that LOOKS like it might be an IP address written in
 * a non-standard form (bare decimal integer "2130706433", hex
 * "0x7f000001", octal-leading-zero groups "017700000001", shortened
 * dotted forms "127.1"/"127.0.1") is a well-known class of SSRF bypass:
 * many resolvers/browsers silently accept and resolve these to the
 * "obvious" IPv4 address even though `classifyIpv4`'s strict pattern
 * wouldn't recognize them as a literal IP at all — which would otherwise
 * let them fall through to a DNS lookup that either fails harmlessly OR
 * (on some resolvers) succeeds and returns exactly the address a
 * strict-form check would have blocked. Anything that could plausibly be
 * interpreted as a numeric IP encoding, in any form, is rejected outright
 * here rather than ever being handed to `dns.lookup`.
 */
function looksLikeAmbiguousNumericHost(hostname: string): boolean {
  if (/^0x[0-9a-f]+$/i.test(hostname)) return true // hex: 0x7f000001
  if (/^\d+$/.test(hostname)) return true // bare decimal integer: 2130706433
  if (/^\d{1,3}(\.\d{1,3}){1,2}$/.test(hostname)) return true // shortened dotted: 127.1, 127.0.1
  if (/^0[0-7]+(\.[0-7]+){0,3}$/.test(hostname)) return true // octal-leading-zero group(s): 017700000001, 0177.0.0.1
  return false
}

export type HostShape = { kind: 'ipv4-literal'; ip: string } | { kind: 'ipv6-literal'; ip: string } | { kind: 'dns-name'; hostname: string } | { kind: 'ambiguous-or-malformed' }

export function classifyHostnameShape(rawHostname: string): HostShape {
  const hostname = rawHostname.toLowerCase()
  if (hostname.length === 0) return { kind: 'ambiguous-or-malformed' }
  if (hostname.includes(':')) return { kind: 'ipv6-literal', ip: hostname }
  if (STRICT_IPV4_PATTERN.test(hostname)) return { kind: 'ipv4-literal', ip: hostname }
  if (looksLikeAmbiguousNumericHost(hostname)) return { kind: 'ambiguous-or-malformed' }
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { kind: 'ambiguous-or-malformed' }
  }
  return { kind: 'dns-name', hostname }
}

// ─── Full capture-URL validation ───────────────────────────────────────

export type UrlSafetyFailure =
  | { kind: 'invalid-url' }
  | { kind: 'unsupported-scheme'; scheme: string }
  | { kind: 'credentials-in-url' }
  | { kind: 'unsafe-port'; port: string }
  | { kind: 'ambiguous-or-malformed-host' }
  | { kind: 'unsafe-literal-address'; classification: IpAddressClassification }
  | { kind: 'dns-resolution-failed' }
  | { kind: 'no-addresses-resolved' }
  | { kind: 'unsafe-resolved-address'; address: string; classification: IpAddressClassification }

export interface ValidatedCaptureUrl {
  url: URL
  hostname: string
  port: number
  /** Every address this hostname resolved to, all independently confirmed
   *  safe — a real DNS name can return several; a mixed answer set (any
   *  address unsafe) fails the whole hostname, never just the unsafe
   *  entries. For a literal IP, this is the single validated address. */
  validatedAddresses: string[]
}

export type UrlSafetyResult = { ok: true; value: ValidatedCaptureUrl } | { ok: false; error: UrlSafetyFailure }

export interface UrlSafetyDeps {
  lookup?: (hostname: string, options: { all: true; verbatim: true }) => Promise<{ address: string; family: number }[]>
  /** Test-only override for address classification (default: the real
   *  `classifyIpAddress` above). Exists so connectionBindingProxy.ts's
   *  own tests can prove the PIPING/no-re-resolution mechanism against a
   *  local test server without needing a real public IP address to
   *  connect to — production code never supplies this, so production
   *  behavior always uses the real, unmodified classifier. */
  classify?: (ip: string) => IpAddressClassification
}

export type HostnameFailure =
  | { kind: 'ambiguous-or-malformed-host' }
  | { kind: 'unsafe-literal-address'; classification: IpAddressClassification }
  | { kind: 'dns-resolution-failed' }
  | { kind: 'no-addresses-resolved' }
  | { kind: 'unsafe-resolved-address'; address: string; classification: IpAddressClassification }

export type HostnameSafetyResult = { ok: true; value: { hostname: string; validatedAddresses: string[] } } | { ok: false; error: HostnameFailure }

/**
 * The bare-hostname half of `validateCaptureUrl` below, factored out so
 * `connectionBindingProxy.ts` can validate a CONNECT tunnel's target
 * (which arrives as a plain "host:port", no scheme/URL at all) using
 * EXACTLY the same classification rules — one source of truth for "is
 * this host safe to connect to," not a second parallel implementation.
 * Never throws; always a typed result.
 */
export async function resolveAndValidateHostname(rawHostname: string, deps: UrlSafetyDeps = {}): Promise<HostnameSafetyResult> {
  const lookup = deps.lookup ?? nodeDnsLookupAll
  const classify = deps.classify ?? classifyIpAddress
  const shape = classifyHostnameShape(rawHostname)

  if (shape.kind === 'ambiguous-or-malformed') {
    return { ok: false, error: { kind: 'ambiguous-or-malformed-host' } }
  }
  if (shape.kind === 'ipv4-literal' || shape.kind === 'ipv6-literal') {
    const classification = classify(shape.ip)
    if (!isSafeClassification(classification)) {
      return { ok: false, error: { kind: 'unsafe-literal-address', classification } }
    }
    return { ok: true, value: { hostname: rawHostname, validatedAddresses: [shape.ip] } }
  }

  let addresses: { address: string; family: number }[]
  try {
    addresses = await lookup(shape.hostname, { all: true, verbatim: true })
  } catch {
    return { ok: false, error: { kind: 'dns-resolution-failed' } }
  }
  if (addresses.length === 0) {
    return { ok: false, error: { kind: 'no-addresses-resolved' } }
  }
  for (const { address } of addresses) {
    const classification = classify(address)
    if (!isSafeClassification(classification)) {
      return { ok: false, error: { kind: 'unsafe-resolved-address', address, classification } }
    }
  }

  return { ok: true, value: { hostname: shape.hostname, validatedAddresses: addresses.map((a) => a.address) } }
}

/**
 * Validates scheme/credentials/port synchronously, then delegates host
 * safety to `resolveAndValidateHostname`. Never throws for an expected-
 * malformed/unsafe input — always a typed result. Does not itself
 * connect to anything; see connectionBindingProxy.ts for the piece that
 * turns "validated" into "actually reachable only by the IP we just
 * checked."
 */
export async function validateCaptureUrl(rawUrl: string, deps: UrlSafetyDeps = {}): Promise<UrlSafetyResult> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, error: { kind: 'invalid-url' } }
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, error: { kind: 'unsupported-scheme', scheme: url.protocol } }
  }
  if (url.username !== '' || url.password !== '') {
    return { ok: false, error: { kind: 'credentials-in-url' } }
  }
  if (url.port !== '' && url.port !== '80' && url.port !== '443') {
    return { ok: false, error: { kind: 'unsafe-port', port: url.port } }
  }

  const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80))
  const hostResult = await resolveAndValidateHostname(url.hostname, deps)
  if (!hostResult.ok) return { ok: false, error: hostResult.error }

  return { ok: true, value: { url, hostname: hostResult.value.hostname, port, validatedAddresses: hostResult.value.validatedAddresses } }
}
