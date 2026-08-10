// Sub-patch 2d (practical scope reset) — tests for the connection-
// binding proxy itself, using plain node:net/node:http clients and a
// local test server only. No real network access, no browser needed:
// these tests prove the proxy's own resolve-then-connect-to-IP-literal
// mechanism, independent of Chrome.
//
// `deps.lookup`/`deps.classify` are injected throughout (see
// networkSafety.ts's own header comment on `classify`) so these tests
// can prove the PIPING/no-re-resolution mechanism against a real local
// server without needing a real public IP to connect to — production
// code never supplies `classify`, so production behavior always uses
// the real, unmodified classifier (already proven independently in
// pipeline.captureNetworkSafety.test.ts).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import http from 'node:http'
import { startConnectionBindingProxy, type ConnectionBindingProxy } from '../src/lib/pipeline/capture/connectionBindingProxy.ts'

async function startLocalOrigin(): Promise<{ server: http.Server; port: number }> {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end(`origin response for ${req.url}`)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('failed to bind local origin')
  return { server, port: address.port }
}

function fakeDeps(safeHost: string, unsafeHost: string) {
  return {
    lookup: async (hostname: string) => {
      if (hostname === safeHost) return [{ address: '127.0.0.1', family: 4 }]
      if (hostname === unsafeHost) return [{ address: '10.1.2.3', family: 4 }]
      if (hostname === 'mixed.invalid') {
        return [
          { address: '127.0.0.1', family: 4 },
          { address: '10.1.2.3', family: 4 },
        ]
      }
      throw new Error(`unexpected test hostname: ${hostname}`)
    },
    classify: (ip: string) => (ip === '127.0.0.1' ? ('public' as const) : ip === '10.1.2.3' ? ('private' as const) : ('unparsable' as const)),
  }
}

function readOnce(socket: net.Socket): Promise<string> {
  return new Promise((resolve) => socket.once('data', (d: Buffer) => resolve(d.toString())))
}

function readUntilClose(socket: net.Socket): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    socket.on('data', (d: Buffer) => (data += d.toString()))
    socket.on('close', () => resolve(data))
  })
}

// ─── CONNECT (HTTPS/WSS tunnel) path ────────────────────────────────

test('CONNECT to a validated-safe host tunnels real bytes end-to-end (proves the piping mechanism, not merely the accept/reject decision)', async () => {
  const { server: origin, port: originPort } = await startLocalOrigin()
  const proxy = await startConnectionBindingProxy({ allowedConnectPort: originPort, deps: fakeDeps('safe.invalid', 'unsafe.invalid') })
  try {
    const client = net.connect(proxy.port, '127.0.0.1')
    await new Promise((resolve) => client.once('connect', resolve))
    client.write(`CONNECT safe.invalid:${originPort} HTTP/1.1\r\nHost: safe.invalid\r\n\r\n`)
    const connectResponse = await readOnce(client)
    assert.match(connectResponse, /^HTTP\/1\.1 200/)

    client.write(`GET /tunnel-check HTTP/1.1\r\nHost: safe.invalid\r\nConnection: close\r\n\r\n`)
    const body = await readUntilClose(client)
    assert.match(body, /origin response for \/tunnel-check/)
  } finally {
    await proxy.close()
    origin.close()
  }
})

test('CONNECT to a private target is rejected (502) — the tunnel is never established, nothing is reachable', async () => {
  const { server: origin, port: originPort } = await startLocalOrigin()
  const proxy = await startConnectionBindingProxy({ allowedConnectPort: originPort, deps: fakeDeps('safe.invalid', 'unsafe.invalid') })
  try {
    const client = net.connect(proxy.port, '127.0.0.1')
    await new Promise((resolve) => client.once('connect', resolve))
    client.write(`CONNECT unsafe.invalid:${originPort} HTTP/1.1\r\nHost: unsafe.invalid\r\n\r\n`)
    const response = await readOnce(client)
    assert.match(response, /^HTTP\/1\.1 502/)
  } finally {
    await proxy.close()
    origin.close()
  }
})

test('CONNECT to a hostname with a MIXED public/private DNS answer set is rejected wholesale', async () => {
  const { server: origin, port: originPort } = await startLocalOrigin()
  const proxy = await startConnectionBindingProxy({ allowedConnectPort: originPort, deps: fakeDeps('safe.invalid', 'unsafe.invalid') })
  try {
    const client = net.connect(proxy.port, '127.0.0.1')
    await new Promise((resolve) => client.once('connect', resolve))
    client.write(`CONNECT mixed.invalid:${originPort} HTTP/1.1\r\nHost: mixed.invalid\r\n\r\n`)
    const response = await readOnce(client)
    assert.match(response, /^HTTP\/1\.1 502/)
  } finally {
    await proxy.close()
    origin.close()
  }
})

test('CONNECT to a disallowed port is rejected (403) before any DNS lookup or connection attempt', async () => {
  const { server: origin, port: originPort } = await startLocalOrigin()
  let lookupCalled = false
  const deps = fakeDeps('safe.invalid', 'unsafe.invalid')
  const proxy = await startConnectionBindingProxy({
    allowedConnectPort: originPort,
    deps: {
      ...deps,
      lookup: async (h: string) => {
        lookupCalled = true
        return deps.lookup(h)
      },
    },
  })
  try {
    const client = net.connect(proxy.port, '127.0.0.1')
    await new Promise((resolve) => client.once('connect', resolve))
    client.write(`CONNECT safe.invalid:9999 HTTP/1.1\r\nHost: safe.invalid\r\n\r\n`)
    const response = await readOnce(client)
    assert.match(response, /^HTTP\/1\.1 403/)
    assert.equal(lookupCalled, false)
  } finally {
    await proxy.close()
    origin.close()
  }
})

// ─── Plain HTTP forwarding path ─────────────────────────────────────

test('a plain absolute-form HTTP GET to a validated-safe host is forwarded and the real response relayed back', async () => {
  const { server: origin, port: originPort } = await startLocalOrigin()
  const proxy = await startConnectionBindingProxy({ allowedHttpPort: originPort, deps: fakeDeps('safe.invalid', 'unsafe.invalid') })
  try {
    const client = net.connect(proxy.port, '127.0.0.1')
    await new Promise((resolve) => client.once('connect', resolve))
    client.write(`GET http://safe.invalid:${originPort}/plain-check HTTP/1.1\r\nHost: safe.invalid:${originPort}\r\n\r\n`)
    const response = await readUntilClose(client)
    assert.match(response, /^HTTP\/1\.1 200/)
    assert.match(response, /origin response for \/plain-check/)
  } finally {
    await proxy.close()
    origin.close()
  }
})

test('a plain absolute-form HTTP GET to a private host is rejected (502), never forwarded anywhere', async () => {
  const { server: origin, port: originPort } = await startLocalOrigin()
  const proxy = await startConnectionBindingProxy({ allowedHttpPort: originPort, deps: fakeDeps('safe.invalid', 'unsafe.invalid') })
  try {
    const client = net.connect(proxy.port, '127.0.0.1')
    await new Promise((resolve) => client.once('connect', resolve))
    client.write(`GET http://unsafe.invalid:${originPort}/ HTTP/1.1\r\nHost: unsafe.invalid:${originPort}\r\n\r\n`)
    const response = await readUntilClose(client)
    assert.match(response, /^HTTP\/1\.1 502/)
  } finally {
    await proxy.close()
    origin.close()
  }
})

// ─── Regression: a validated tunnel must never be reusable for a
// second, different (and potentially unvalidated) destination ─────────
// Found during 2d's own development: the first version of the plain-
// HTTP-forwarding path piped the client socket bidirectionally
// indefinitely, so a second request pipelined onto the SAME already-
// open proxy connection (exactly what an HTTP client's keep-alive
// connection pool can do) would be silently forwarded to whichever
// origin the FIRST request had already validated and connected to —
// skipping per-request validation entirely for the second request.

test('a second HTTP request sent on the SAME already-validated proxy connection is never silently forwarded to the first request\'s origin — the connection is closed after one response, forcing a fresh (freshly-validated) connection', async () => {
  const { server: origin, port: originPort } = await startLocalOrigin()
  const proxy = await startConnectionBindingProxy({ allowedHttpPort: originPort, deps: fakeDeps('safe.invalid', 'unsafe.invalid') })
  try {
    const client = net.connect(proxy.port, '127.0.0.1')
    await new Promise((resolve) => client.once('connect', resolve))
    client.write(`GET http://safe.invalid:${originPort}/first HTTP/1.1\r\nHost: safe.invalid:${originPort}\r\n\r\n`)
    const firstResponse = await readUntilClose(client)
    assert.match(firstResponse, /origin response for \/first/)

    // The proxy must have closed its end after the first response —
    // proven by the socket already being unwritable/closed, not by
    // successfully piggy-backing a second request onto it.
    assert.equal(client.writable, false, 'the client socket must be closed after one response, not left open for reuse')
  } finally {
    await proxy.close()
    origin.close()
  }
})

// ─── Concurrency / total-connection limits ──────────────────────────

test('totalConnections() tracks every accepted connection, and a fresh proxy starts at zero', async () => {
  const { server: origin, port: originPort } = await startLocalOrigin()
  const proxy = await startConnectionBindingProxy({ allowedConnectPort: originPort, deps: fakeDeps('safe.invalid', 'unsafe.invalid') })
  try {
    assert.equal(proxy.totalConnections(), 0)
    const client = net.connect(proxy.port, '127.0.0.1')
    await new Promise((resolve) => client.once('connect', resolve))
    client.write(`CONNECT safe.invalid:${originPort} HTTP/1.1\r\nHost: safe.invalid\r\n\r\n`)
    await readOnce(client)
    assert.equal(proxy.totalConnections(), 1)
    client.destroy()
  } finally {
    await proxy.close()
    origin.close()
  }
})

test('exceeding maxTotalConnections rejects further connections', async () => {
  const { server: origin, port: originPort } = await startLocalOrigin()
  const proxy = await startConnectionBindingProxy({ allowedConnectPort: originPort, maxTotalConnections: 1, deps: fakeDeps('safe.invalid', 'unsafe.invalid') })
  try {
    const first = net.connect(proxy.port, '127.0.0.1')
    await new Promise((resolve) => first.once('connect', resolve))
    first.write(`CONNECT safe.invalid:${originPort} HTTP/1.1\r\nHost: safe.invalid\r\n\r\n`)
    await readOnce(first)

    const second = net.connect(proxy.port, '127.0.0.1')
    await new Promise((resolve) => second.once('connect', resolve))
    second.write(`CONNECT safe.invalid:${originPort} HTTP/1.1\r\nHost: safe.invalid\r\n\r\n`)
    const response = await readUntilClose(second)
    assert.match(response, /^HTTP\/1\.1 503/)
    first.destroy()
  } finally {
    await proxy.close()
    origin.close()
  }
})

// ─── Concurrency: enforced across the FULL lifetime of a tunnel, not
// merely the moment it was accepted ──────────────────────────────────
// Regression coverage for a real bug found during 2d's own review: the
// first version decremented the concurrency counter as soon as
// handleClient() RETURNED, which for an established CONNECT tunnel is
// almost immediately after accept — undercounting every open tunnel as
// already-closed while it was still actively relaying bytes.

test('maxConcurrentConnections rejects a second CONNECT while the first tunnel is still OPEN (not merely being established)', async () => {
  const { server: origin, port: originPort } = await startLocalOrigin()
  const proxy = await startConnectionBindingProxy({ allowedConnectPort: originPort, maxConcurrentConnections: 1, deps: fakeDeps('safe.invalid', 'unsafe.invalid') })
  try {
    const first = net.connect(proxy.port, '127.0.0.1')
    await new Promise((resolve) => first.once('connect', resolve))
    first.write(`CONNECT safe.invalid:${originPort} HTTP/1.1\r\nHost: safe.invalid\r\n\r\n`)
    await readOnce(first)
    assert.equal(proxy.activeConnections(), 1, 'the established tunnel must still count as active')

    // Give the event loop a beat — proves the count doesn't decay on its
    // own just because handleClient() has returned; the tunnel is still
    // genuinely open (first was never destroyed).
    await new Promise((r) => setTimeout(r, 50))
    assert.equal(proxy.activeConnections(), 1, 'the tunnel must still be counted active well after establishment, while genuinely open')

    const second = net.connect(proxy.port, '127.0.0.1')
    await new Promise((resolve) => second.once('connect', resolve))
    second.write(`CONNECT safe.invalid:${originPort} HTTP/1.1\r\nHost: safe.invalid\r\n\r\n`)
    const response = await readUntilClose(second)
    assert.match(response, /^HTTP\/1\.1 503/, 'a second concurrent connection must be rejected while the first tunnel is still open')

    first.destroy()
    await new Promise((resolve) => first.once('close', resolve))
    assert.equal(proxy.activeConnections(), 0, 'closing the first tunnel must free the concurrency slot')

    // With the slot freed, a new connection must now succeed.
    const third = net.connect(proxy.port, '127.0.0.1')
    await new Promise((resolve) => third.once('connect', resolve))
    third.write(`CONNECT safe.invalid:${originPort} HTTP/1.1\r\nHost: safe.invalid\r\n\r\n`)
    const thirdResponse = await readOnce(third)
    assert.match(thirdResponse, /^HTTP\/1\.1 200/, 'a fresh connection must be accepted once the slot is freed')
    third.destroy()
  } finally {
    await proxy.close()
    origin.close()
  }
})

test('the concurrency slot is freed even when a connection is abruptly destroyed (cancellation) or errors, not only on a clean close', async () => {
  const { server: origin, port: originPort } = await startLocalOrigin()
  const proxy = await startConnectionBindingProxy({ allowedConnectPort: originPort, maxConcurrentConnections: 1, deps: fakeDeps('safe.invalid', 'unsafe.invalid') })
  try {
    const first = net.connect(proxy.port, '127.0.0.1')
    first.on('error', () => {}) // destroy(err) below emits 'error' on this end too — expected, not a failure
    await new Promise((resolve) => first.once('connect', resolve))
    first.write(`CONNECT safe.invalid:${originPort} HTTP/1.1\r\nHost: safe.invalid\r\n\r\n`)
    await readOnce(first)
    assert.equal(proxy.activeConnections(), 1)

    // Abrupt destroy — no clean HTTP close, simulating a cancelled
    // capture or a crashed browser process yanking the connection away.
    // Our OWN socket's 'close' event (awaited here) fires client-side;
    // the SERVER's accepted socket notices and fires its own 'close' —
    // which is what actually frees the slot — a moment later, so this
    // polls briefly rather than asserting the instant our side closes.
    first.destroy(new Error('simulated abrupt cancellation'))
    await new Promise((resolve) => first.once('close', resolve))
    const deadline = Date.now() + 2000
    while (proxy.activeConnections() !== 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 10))
    }
    assert.equal(proxy.activeConnections(), 0, 'an abruptly destroyed connection must still free its concurrency slot')
  } finally {
    await proxy.close()
    origin.close()
  }
})

test('activeConnections() also decrements correctly for the plain-HTTP forwarding path once its one-shot response completes', async () => {
  const { server: origin, port: originPort } = await startLocalOrigin()
  const proxy = await startConnectionBindingProxy({ allowedHttpPort: originPort, deps: fakeDeps('safe.invalid', 'unsafe.invalid') })
  try {
    const client = net.connect(proxy.port, '127.0.0.1')
    await new Promise((resolve) => client.once('connect', resolve))
    client.write(`GET http://safe.invalid:${originPort}/ HTTP/1.1\r\nHost: safe.invalid:${originPort}\r\n\r\n`)
    await readUntilClose(client)
    // pipeOneShotResponse tears the client socket down once the
    // response finishes — activeConnections must reflect that.
    await new Promise((r) => setTimeout(r, 20))
    assert.equal(proxy.activeConnections(), 0)
  } finally {
    await proxy.close()
    origin.close()
  }
})

// ─── Cleanup ─────────────────────────────────────────────────────────

test('close() stops the proxy from accepting further connections', async () => {
  const proxy: ConnectionBindingProxy = await startConnectionBindingProxy({ deps: fakeDeps('safe.invalid', 'unsafe.invalid') })
  const port = proxy.port
  await proxy.close()
  const client = net.connect(port, '127.0.0.1')
  const failed = await new Promise((resolve) => {
    client.once('error', () => resolve(true))
    client.once('connect', () => resolve(false))
  })
  assert.equal(failed, true, 'connecting after close() must fail')
})
