// Shared SSRF-safety helpers for server-side checkers that make outbound network
// requests on a visitor's behalf. Node-only (uses node:dns) — do not import from
// browser-side code. This is a standalone copy used only by api/check-visual.ts;
// api/check-website.ts (V1) keeps its own independent copy and is not touched here,
// so V1's behavior is guaranteed unaffected by any change in this file.

import { lookup } from 'node:dns/promises'

export class UnsafeUrlError extends Error {}

// ─── Private/internal address detection ─────────────────────────
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

export function isPrivateIPv4(ip: string): boolean {
  const int = ipv4ToInt(ip)
  if (int === null) return true // unparsable — treat as unsafe
  const blocked: Array<[string, number]> = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16], // includes cloud metadata 169.254.169.254
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

export function isPrivateIPv6(ip: string): boolean {
  // Node's URL.hostname keeps brackets around IPv6 literals (e.g. "[::1]") — strip them before comparing.
  const normalized = ip.toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
  if (normalized === '::1' || normalized === '::') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true // fc00::/7 ULA
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true // fe80::/10 link-local
  }
  const mappedDotted = normalized.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (mappedDotted) return isPrivateIPv4(mappedDotted[1])

  const mappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16)
    const lo = parseInt(mappedHex[2], 16)
    const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
    return isPrivateIPv4(ipv4)
  }
  return false
}

export function isPrivateIp(ip: string): boolean {
  return ip.includes(':') ? isPrivateIPv6(ip) : isPrivateIPv4(ip)
}

/** Validates protocol/port/hostname and resolves DNS, rejecting anything private or internal. */
export async function assertSafeUrl(url: URL): Promise<void> {
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

/**
 * A fast, memoized, non-throwing safety check designed for high-frequency use
 * (e.g. validating every subresource request during a page load). Caches the
 * per-hostname result so a CDN host referenced by many images/scripts is only
 * resolved once per check session.
 */
export function createHostnameSafetyCache() {
  const cache = new Map<string, Promise<boolean>>()

  return async function isUrlSafe(rawUrl: string): Promise<boolean> {
    let url: URL
    try {
      url = new URL(rawUrl)
    } catch {
      return false
    }

    // data:/blob: never cause a network request — always safe to allow.
    if (url.protocol === 'data:' || url.protocol === 'blob:') return true
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false

    const key = url.hostname.toLowerCase()
    let pending = cache.get(key)
    if (!pending) {
      pending = assertSafeUrl(url)
        .then(() => true)
        .catch(() => false)
      cache.set(key, pending)
    }
    return pending
  }
}
