// Sub-patch 2d (practical scope reset) — deterministic, offline unit
// tests for src/lib/pipeline/capture/networkSafety.ts. No network, no
// browser, no real DNS: `resolveAndValidateHostname`/`validateCaptureUrl`
// are always exercised with an injected fake `lookup`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyIpv4, classifyIpv6, classifyIpAddress, classifyHostnameShape, resolveAndValidateHostname, validateCaptureUrl } from '../src/lib/pipeline/capture/networkSafety.ts'

// ─── IPv4 classification — every required category ──────────────────

test('IPv4: public addresses are classified public', () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34']) assert.equal(classifyIpv4(ip), 'public')
})

test('IPv4: loopback (127.0.0.0/8) is blocked', () => {
  assert.equal(classifyIpv4('127.0.0.1'), 'loopback')
  assert.equal(classifyIpv4('127.255.255.255'), 'loopback')
})

test('IPv4: private ranges (10/8, 172.16/12, 192.168/16, 100.64/10 CGNAT) are blocked', () => {
  assert.equal(classifyIpv4('10.1.2.3'), 'private')
  assert.equal(classifyIpv4('172.16.0.1'), 'private')
  assert.equal(classifyIpv4('172.31.255.255'), 'private')
  assert.equal(classifyIpv4('172.32.0.1'), 'public', '172.32/12 is outside the private range — must not over-block')
  assert.equal(classifyIpv4('192.168.1.1'), 'private')
  assert.equal(classifyIpv4('100.64.0.1'), 'private')
  assert.equal(classifyIpv4('100.127.255.255'), 'private')
})

test('IPv4: link-local (169.254.0.0/16) is blocked', () => {
  assert.equal(classifyIpv4('169.254.1.1'), 'link-local')
})

test('IPv4: the cloud-metadata address (169.254.169.254) is specifically distinguished from general link-local', () => {
  assert.equal(classifyIpv4('169.254.169.254'), 'cloud-metadata')
})

test('IPv4: reserved ranges (0/8, TEST-NETs, benchmarking, future-use/broadcast) are blocked', () => {
  assert.equal(classifyIpv4('0.1.2.3'), 'reserved')
  assert.equal(classifyIpv4('192.0.2.1'), 'reserved')
  assert.equal(classifyIpv4('198.18.0.1'), 'reserved')
  assert.equal(classifyIpv4('198.51.100.1'), 'reserved')
  assert.equal(classifyIpv4('203.0.113.1'), 'reserved')
  assert.equal(classifyIpv4('240.0.0.1'), 'reserved')
  assert.equal(classifyIpv4('255.255.255.255'), 'reserved')
})

test('IPv4: multicast (224.0.0.0/4) is blocked', () => {
  assert.equal(classifyIpv4('224.0.0.1'), 'multicast')
  assert.equal(classifyIpv4('239.255.255.255'), 'multicast')
})

test('IPv4: 0.0.0.0 is classified unspecified (blocked, distinct from general reserved)', () => {
  assert.equal(classifyIpv4('0.0.0.0'), 'unspecified')
})

test('IPv4: malformed/out-of-range octets are unparsable (fail closed)', () => {
  assert.equal(classifyIpv4('999.1.1.1'), 'unparsable')
  assert.equal(classifyIpv4('1.2.3'), 'unparsable')
  assert.equal(classifyIpv4('not-an-ip'), 'unparsable')
})

// ─── IPv6 classification — every required category ──────────────────

test('IPv6: loopback (::1) and unspecified (::) are blocked/distinguished', () => {
  assert.equal(classifyIpv6('::1'), 'loopback')
  assert.equal(classifyIpv6('::'), 'unspecified')
})

test('IPv6: link-local (fe80::/10) is blocked, including with a zone ID', () => {
  assert.equal(classifyIpv6('fe80::1'), 'link-local')
  assert.equal(classifyIpv6('fe80::1%eth0'), 'link-local')
})

test('IPv6: unique-local/private (fc00::/7) is blocked', () => {
  assert.equal(classifyIpv6('fc00::1'), 'private')
  assert.equal(classifyIpv6('fd12:3456:789a::1'), 'private')
})

test('IPv6: multicast (ff00::/8) is blocked', () => {
  assert.equal(classifyIpv6('ff02::1'), 'multicast')
  assert.equal(classifyIpv6('ff00::'), 'multicast')
})

test('IPv6: reserved ranges (documentation 2001:db8::/32, discard-only 100::/64) are blocked', () => {
  assert.equal(classifyIpv6('2001:db8::1'), 'reserved')
  assert.equal(classifyIpv6('100::1'), 'reserved')
})

test('IPv6: public addresses are classified public', () => {
  assert.equal(classifyIpv6('2001:4860:4860::8888'), 'public')
})

test('IPv6: IPv4-mapped (::ffff:a.b.c.d) and NAT64 (64:ff9b::a.b.c.d) addresses are classified by the embedded IPv4 address, including cloud-metadata', () => {
  assert.equal(classifyIpv6('::ffff:127.0.0.1'), 'loopback')
  assert.equal(classifyIpv6('::ffff:10.0.0.1'), 'private')
  assert.equal(classifyIpv6('::ffff:8.8.8.8'), 'public')
  assert.equal(classifyIpv6('64:ff9b::8.8.8.8'), 'public')
  assert.equal(classifyIpv6('64:ff9b::169.254.169.254'), 'cloud-metadata')
})

test('IPv6: bracketed form (as URL.hostname produces) classifies the same as the bare form', () => {
  assert.equal(classifyIpv6('[::1]'), 'loopback')
  assert.equal(classifyIpv6('[fe80::1]'), 'link-local')
})

test('IPv6: structurally invalid literals are unparsable (fail closed)', () => {
  assert.equal(classifyIpv6('not-an-ip'), 'unparsable')
  assert.equal(classifyIpv6('::gggg'), 'unparsable')
  assert.equal(classifyIpv6('1:2:3:4:5:6:7:8:9'), 'unparsable', 'too many groups')
})

test('classifyIpAddress dispatches by colon-presence to the right classifier', () => {
  assert.equal(classifyIpAddress('127.0.0.1'), 'loopback')
  assert.equal(classifyIpAddress('::1'), 'loopback')
})

// ─── Alternate IPv4 encodings — a well-known SSRF bypass class ───────
// These must never be treated as a DNS hostname (and thus never handed
// to `dns.lookup`, where some resolvers silently accept and resolve
// them to exactly the address a strict-form check would have blocked).

test('hostname shape: alternate numeric encodings of a private IP are rejected as ambiguous, not passed through to DNS', () => {
  for (const host of ['2130706433', '0x7f000001', '017700000001', '127.1', '127.0.1', '0177.0.0.1']) {
    assert.equal(classifyHostnameShape(host).kind, 'ambiguous-or-malformed', `"${host}" must be rejected outright`)
  }
})

test('hostname shape: a strict dotted-quad literal is recognized as an IPv4 literal', () => {
  assert.deepEqual(classifyHostnameShape('127.0.0.1'), { kind: 'ipv4-literal', ip: '127.0.0.1' })
})

test('hostname shape: localhost / .localhost / .local / .internal are rejected outright', () => {
  for (const host of ['localhost', 'foo.localhost', 'foo.local', 'foo.internal']) {
    assert.equal(classifyHostnameShape(host).kind, 'ambiguous-or-malformed')
  }
})

test('hostname shape: an ordinary DNS name is recognized as such', () => {
  assert.deepEqual(classifyHostnameShape('Example.COM'), { kind: 'dns-name', hostname: 'example.com' })
})

// ─── resolveAndValidateHostname — DNS resolution, mixed answer sets ──

test('resolveAndValidateHostname: a hostname resolving only to public addresses is validated', async () => {
  const result = await resolveAndValidateHostname('safe.invalid', { lookup: async () => [{ address: '93.184.216.34', family: 4 }] })
  assert.equal(result.ok, true)
  if (result.ok) assert.deepEqual(result.value.validatedAddresses, ['93.184.216.34'])
})

test('resolveAndValidateHostname: a MIXED public/private answer set is rejected wholesale — one unsafe address fails the whole hostname', async () => {
  const result = await resolveAndValidateHostname('mixed.invalid', {
    lookup: async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ],
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.kind, 'unsafe-resolved-address')
})

test('resolveAndValidateHostname: DNS resolution failure is a typed error, not a throw', async () => {
  const result = await resolveAndValidateHostname('nonexistent.invalid', {
    lookup: async () => {
      throw new Error('ENOTFOUND')
    },
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.kind, 'dns-resolution-failed')
})

test('resolveAndValidateHostname: an IPv4 literal hostname is validated without any DNS lookup', async () => {
  let lookupCalled = false
  const result = await resolveAndValidateHostname('8.8.8.8', {
    lookup: async () => {
      lookupCalled = true
      return []
    },
  })
  assert.equal(result.ok, true)
  assert.equal(lookupCalled, false)
})

// ─── validateCaptureUrl — the full scheme/credentials/port/host path ──

test('validateCaptureUrl accepts a well-formed https URL resolving to a public address', async () => {
  const result = await validateCaptureUrl('https://example.invalid/path', { lookup: async () => [{ address: '93.184.216.34', family: 4 }] })
  assert.equal(result.ok, true)
})

test('validateCaptureUrl rejects a non-http(s) scheme', async () => {
  const result = await validateCaptureUrl('file:///etc/passwd')
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.kind, 'unsupported-scheme')
})

test('validateCaptureUrl rejects credentials embedded in the URL', async () => {
  const result = await validateCaptureUrl('https://user:pass@example.invalid/', { lookup: async () => [{ address: '93.184.216.34', family: 4 }] })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.kind, 'credentials-in-url')
})

test('validateCaptureUrl rejects a non-standard port', async () => {
  const result = await validateCaptureUrl('https://example.invalid:8443/')
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.kind, 'unsafe-port')
})

test('validateCaptureUrl accepts explicit default ports (80 for http, 443 for https)', async () => {
  const r1 = await validateCaptureUrl('https://example.invalid:443/', { lookup: async () => [{ address: '93.184.216.34', family: 4 }] })
  const r2 = await validateCaptureUrl('http://example.invalid:80/', { lookup: async () => [{ address: '93.184.216.34', family: 4 }] })
  assert.equal(r1.ok, true)
  assert.equal(r2.ok, true)
})

test('validateCaptureUrl rejects an invalid URL string outright, never throws', async () => {
  const result = await validateCaptureUrl('not a url at all')
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.kind, 'invalid-url')
})

test('validateCaptureUrl rejects a literal private IPv4 address with no DNS lookup performed', async () => {
  let lookupCalled = false
  const result = await validateCaptureUrl('http://10.0.0.5/', {
    lookup: async () => {
      lookupCalled = true
      return []
    },
  })
  assert.equal(result.ok, false)
  assert.equal(lookupCalled, false)
  if (!result.ok) assert.equal(result.error.kind, 'unsafe-literal-address')
})

test('validateCaptureUrl rejects a literal private IPv6 address', async () => {
  const result = await validateCaptureUrl('http://[fc00::1]/')
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.error.kind, 'unsafe-literal-address')
})

test('validateCaptureUrl rejects the cloud-metadata address specifically', async () => {
  const result = await validateCaptureUrl('http://169.254.169.254/latest/meta-data/')
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.error.kind, 'unsafe-literal-address')
    if (result.error.kind === 'unsafe-literal-address') assert.equal(result.error.classification, 'cloud-metadata')
  }
})

test('validateCaptureUrl rejects a decimal-integer-encoded loopback address, with no DNS lookup performed — WHATWG URL parsing itself canonicalizes "2130706433" to "127.0.0.1" before classification runs, so this is blocked as unsafe-literal-address rather than ambiguous-or-malformed-host; the safety property (blocked, no lookup) holds either way', async () => {
  let lookupCalled = false
  const result = await validateCaptureUrl('http://2130706433/', {
    lookup: async () => {
      lookupCalled = true
      return []
    },
  })
  assert.equal(result.ok, false)
  assert.equal(lookupCalled, false)
  if (!result.ok) assert.equal(result.error.kind, 'unsafe-literal-address')
})

test('resolveAndValidateHostname (the bare-hostname path connectionBindingProxy.ts uses for a raw CONNECT target, which is NOT passed through new URL() first) rejects alternate numeric IP encodings directly via classifyHostnameShape, with no DNS lookup performed', async () => {
  for (const host of ['2130706433', '0x7f000001', '017700000001', '127.1']) {
    let lookupCalled = false
    const result = await resolveAndValidateHostname(host, {
      lookup: async () => {
        lookupCalled = true
        return []
      },
    })
    assert.equal(result.ok, false, `"${host}" must be rejected`)
    assert.equal(lookupCalled, false, `"${host}" must never reach DNS lookup`)
    if (!result.ok) assert.equal(result.error.kind, 'ambiguous-or-malformed-host')
  }
})
