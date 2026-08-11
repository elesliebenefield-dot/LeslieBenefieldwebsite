// Sub-patch 2d (practical scope reset) — the actual connection-binding
// guarantee.
//
// networkSafety.ts can tell you a hostname is safe RIGHT NOW, but a
// browser given that same hostname will resolve it AGAIN itself before
// connecting — and DNS can change between those two moments (rebinding:
// an attacker's nameserver answers safely for our check, then answers
// with a private/internal address a few milliseconds later for the
// browser's own connect). Preflight DNS validation alone never closes
// that gap; this file does, by removing the browser's own resolution
// from the picture entirely.
//
// Chrome is launched (browserLifecycle.ts) with --proxy-server pointing
// at this local, request-scoped HTTP CONNECT proxy, with no proxy-bypass
// list — so EVERY TCP connection Chrome makes (the top-level navigation,
// every redirect leg, every subresource fetch) is forced through here,
// uniformly, with no special-casing needed for "newly encountered
// hosts." For each one, THIS code — not Chrome — resolves the target
// hostname, validates every resolved address via networkSafety.ts, and
// then connects directly to the validated IP LITERAL. Chrome never gets
// a chance to re-resolve: once we've dialed the real destination
// ourselves and confirmed it's safe, we just splice the two raw byte
// streams together. For CONNECT (HTTPS/WSS) tunnels this also means TLS
// is untouched end-to-end between Chrome and the origin — we never
// terminate or inspect it, so certificate/identity verification still
// happens exactly as it would without a proxy.
//
// Residual, honestly-stated gap: the only remaining window is between
// OUR OWN `resolveAndValidateHostname` call and OUR OWN `net.connect`
// call a few lines later, in the same synchronous flow of one function —
// there is no meaningful attacker-observable delay to target there, but
// it is not literally zero, and this file does not claim it is.
//
// Import boundary: Node-only (net/http), no import from
// src/lib/pipeline/types/ — this is check-agnostic transport
// infrastructure.

import net from 'node:net'
import { resolveAndValidateHostname, type UrlSafetyDeps } from './networkSafety.js'

export interface ConnectionBindingProxyOptions {
  /** Only these destination ports are ever dialed — 443 for CONNECT
   *  (TLS) tunnels, 80 for plain HTTP forwarding. Matches the same
   *  80/443-only policy enforced upstream in networkSafety.ts; enforced
   *  again here independently (defense in depth — this proxy must not
   *  simply trust that every caller already checked). */
  allowedConnectPort?: number
  allowedHttpPort?: number
  maxConcurrentConnections?: number
  maxTotalConnections?: number
  deps?: UrlSafetyDeps
}

export interface ConnectionBindingProxy {
  port: number
  /** Total CONNECT/HTTP requests accepted so far (cumulative, never
   *  decremented — for tests/limits). */
  totalConnections(): number
  /** Connections currently open, from accept until the client socket
   *  fully closes — covers the whole lifetime of an established tunnel,
   *  not merely the moment it was accepted (for tests/limits). */
  activeConnections(): number
  close(): Promise<void>
}

const DEFAULT_ALLOWED_CONNECT_PORT = 443
const DEFAULT_ALLOWED_HTTP_PORT = 80
const DEFAULT_MAX_CONCURRENT = 6
const DEFAULT_MAX_TOTAL = 200
const HEADER_READ_TIMEOUT_MS = 5000
const MAX_HEADER_BYTES = 16 * 1024

function writeAndDestroy(socket: net.Socket, statusLine: string): void {
  try {
    socket.end(`${statusLine}\r\n\r\n`)
  } catch {
    /* socket may already be gone */
  }
}

/** Reads bytes off `socket` until the end of the HTTP header block
 *  (\r\n\r\n) or a byte/time limit is hit — enough to parse the request
 *  line + Host header for either a CONNECT tunnel or one absolute-form
 *  HTTP request, without pulling in a full HTTP parser dependency. */
function readHeaderBlock(socket: net.Socket): Promise<{ headText: string; rest: Buffer } | null> {
  return new Promise((resolve) => {
    let buf = Buffer.alloc(0)
    let settled = false
    const finish = (result: { headText: string; rest: Buffer } | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.removeListener('data', onData)
      socket.removeListener('error', onError)
      socket.removeListener('close', onClose)
      resolve(result)
    }
    const timer = setTimeout(() => finish(null), HEADER_READ_TIMEOUT_MS)
    const onError = () => finish(null)
    const onClose = () => finish(null)
    const onData = (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk])
      if (buf.length > MAX_HEADER_BYTES) {
        finish(null)
        return
      }
      const idx = buf.indexOf('\r\n\r\n')
      if (idx !== -1) {
        finish({ headText: buf.subarray(0, idx).toString('latin1'), rest: buf.subarray(idx + 4) })
      }
    }
    socket.on('data', onData)
    socket.on('error', onError)
    socket.on('close', onClose)
  })
}

function parseHostPort(hostPort: string, defaultPort: number): { host: string; port: number } | null {
  const trimmed = hostPort.trim()
  if (trimmed === '') return null
  // Bracketed IPv6: "[::1]:443" or bare "[::1]"
  const bracketMatch = trimmed.match(/^\[([^\]]+)\](?::(\d+))?$/)
  if (bracketMatch) {
    const port = bracketMatch[2] ? Number(bracketMatch[2]) : defaultPort
    return { host: bracketMatch[1], port }
  }
  const lastColon = trimmed.lastIndexOf(':')
  if (lastColon === -1) return { host: trimmed, port: defaultPort }
  const hostPart = trimmed.slice(0, lastColon)
  const portPart = trimmed.slice(lastColon + 1)
  if (hostPart.includes(':')) return null // an un-bracketed literal IPv6 host:port is ambiguous — reject
  if (!/^\d+$/.test(portPart)) return null
  return { host: hostPart, port: Number(portPart) }
}

async function connectToValidatedHost(
  host: string,
  port: number,
  deps: UrlSafetyDeps | undefined
): Promise<{ ok: true; socket: net.Socket } | { ok: false; reason: string }> {
  const result = await resolveAndValidateHostname(host, deps)
  if (!result.ok) return { ok: false, reason: result.error.kind }

  // Connect to the validated IP LITERAL, not the hostname — this is the
  // step that actually closes the DNS-rebinding gap: nothing after this
  // point performs another lookup for `host`.
  const address = result.value.validatedAddresses[0]
  return new Promise((resolve) => {
    const remote = net.connect({ host: address, port })
    // A permanent safety-net listener, attached before anything else
    // and never removed: Node treats an 'error' event with no listener
    // as an uncaught exception (crashing the process), and once this
    // socket is handed off to piping later, ownership of "what an error
    // here means" belongs to the pipe/cleanup logic, not this function
    // — but there must never be a gap where NO listener is attached at
    // all, however narrow.
    remote.on('error', () => {})
    const onConnectFailure = () => resolve({ ok: false, reason: 'connect-failed' })
    remote.once('error', onConnectFailure)
    remote.once('connect', () => {
      remote.removeListener('error', onConnectFailure)
      resolve({ ok: true, socket: remote })
    })
  })
}

export function startConnectionBindingProxy(options: ConnectionBindingProxyOptions = {}): Promise<ConnectionBindingProxy> {
  const allowedConnectPort = options.allowedConnectPort ?? DEFAULT_ALLOWED_CONNECT_PORT
  const allowedHttpPort = options.allowedHttpPort ?? DEFAULT_ALLOWED_HTTP_PORT
  const maxConcurrent = options.maxConcurrentConnections ?? DEFAULT_MAX_CONCURRENT
  const maxTotal = options.maxTotalConnections ?? DEFAULT_MAX_TOTAL
  const deps = options.deps

  let total = 0

  // `server.close()` alone only stops accepting NEW connections — its
  // callback does not fire until every existing connection has ended,
  // and a socket destroyed on the client's end doesn't always tear down
  // its server-side/piped counterpart quickly enough to be relied on.
  // Tracking every live socket here (both accepted client sockets and
  // the outbound sockets they're piped to) lets close() force them all
  // down immediately, guaranteeing cleanup completes rather than
  // depending on how promptly each side notices the other went away.
  const liveSockets = new Set<net.Socket>()
  function track(socket: net.Socket): void {
    liveSockets.add(socket)
    socket.once('close', () => liveSockets.delete(socket))
  }

  // Concurrency, covering the FULL lifetime of a connection — from
  // accept until the client socket's own 'close' event, which fires
  // exactly once no matter how the connection ends (clean finish, error,
  // destroy(), or the piped tunnel/remote side going away and dragging
  // this socket down with it via pipeBothWays/pipeOneShotResponse's own
  // cleanup). A prior version decremented as soon as `handleClient`
  // RETURNED, which for a successfully established CONNECT tunnel is
  // almost immediately — undercounting every open tunnel as if it had
  // already ended. Tracked as its own Set (not derived from
  // `liveSockets`, which also holds the paired remote/upstream sockets)
  // so `activeConnections` counts exactly one entry per logical proxy
  // connection.
  const activeConnections = new Set<net.Socket>()

  const server = net.createServer((clientSocket) => {
    // Same permanent safety net as connectToValidatedHost's `remote`
    // socket above — Chrome resetting a connection mid-tunnel (e.g. on
    // navigation-away, page close, or its own crash) must never surface
    // as an unhandled 'error' event.
    clientSocket.on('error', () => {})
    track(clientSocket)

    total++
    if (total > maxTotal) {
      writeAndDestroy(clientSocket, 'HTTP/1.1 503 Too Many Requests For This Capture')
      return
    }
    if (activeConnections.size >= maxConcurrent) {
      writeAndDestroy(clientSocket, 'HTTP/1.1 503 Too Many Concurrent Connections')
      return
    }
    // Decrement is registered before any async work starts, on the
    // socket's own 'close' event — guaranteed to fire on every path
    // (normal completion, thrown error inside handleClient, an abrupt
    // client-side destroy/cancellation, or this proxy's own
    // writeAndDestroy rejection paths below), so the count can never
    // leak upward regardless of which path a given connection takes.
    activeConnections.add(clientSocket)
    clientSocket.once('close', () => activeConnections.delete(clientSocket))

    void handleClient(clientSocket)
  })

  async function handleClient(clientSocket: net.Socket): Promise<void> {
    const headResult = await readHeaderBlock(clientSocket)
    if (!headResult) {
      writeAndDestroy(clientSocket, 'HTTP/1.1 400 Bad Request')
      return
    }
    const lines = headResult.headText.split('\r\n')
    const requestLine = lines[0] ?? ''
    const [method, target] = requestLine.split(' ')

    if (method === 'CONNECT') {
      const parsed = target ? parseHostPort(target, allowedConnectPort) : null
      if (!parsed || parsed.port !== allowedConnectPort) {
        writeAndDestroy(clientSocket, 'HTTP/1.1 403 Forbidden')
        return
      }
      const outcome = await connectToValidatedHost(parsed.host, parsed.port, deps)
      if (!outcome.ok) {
        writeAndDestroy(clientSocket, 'HTTP/1.1 502 Bad Gateway')
        return
      }
      track(outcome.socket)
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      if (headResult.rest.length > 0) outcome.socket.write(headResult.rest)
      pipeBothWays(clientSocket, outcome.socket)
      return
    }

    // Plain HTTP, absolute-form request line: "GET http://host/path HTTP/1.1"
    if (target && /^https?:\/\//i.test(target)) {
      let url: URL
      try {
        url = new URL(target)
      } catch {
        writeAndDestroy(clientSocket, 'HTTP/1.1 400 Bad Request')
        return
      }
      const port = url.port ? Number(url.port) : allowedHttpPort
      if (url.protocol !== 'http:' || port !== allowedHttpPort) {
        writeAndDestroy(clientSocket, 'HTTP/1.1 403 Forbidden')
        return
      }
      const outcome = await connectToValidatedHost(url.hostname, port, deps)
      if (!outcome.ok) {
        writeAndDestroy(clientSocket, 'HTTP/1.1 502 Bad Gateway')
        return
      }
      track(outcome.socket)
      // Every plain-HTTP proxy connection carries exactly ONE request.
      // A validated destination must never be silently reused for a
      // SECOND, different-origin request Chrome might try to pipeline
      // onto the same keep-alive proxy socket — that would skip
      // per-request validation entirely for the second request. Both
      // the outgoing request and the response we relay back are
      // rewritten/forced to `Connection: close`, and the client socket
      // is torn down once this one response finishes, forcing Chrome to
      // open a fresh (freshly-validated) proxy connection for anything
      // after.
      const originForm = `${url.pathname}${url.search}`
      const rewrittenRequestLine = `${method} ${originForm} HTTP/1.1`
      const forwardedLines = [rewrittenRequestLine, ...lines.slice(1).filter((l) => !/^(connection|proxy-connection):/i.test(l)), 'Connection: close']
      outcome.socket.write(`${forwardedLines.join('\r\n')}\r\n\r\n`)
      if (headResult.rest.length > 0) outcome.socket.write(headResult.rest)
      pipeOneShotResponse(clientSocket, outcome.socket)
      return
    }

    writeAndDestroy(clientSocket, 'HTTP/1.1 400 Bad Request')
  }

  function pipeBothWays(a: net.Socket, b: net.Socket): void {
    const cleanup = () => {
      a.unpipe(b)
      b.unpipe(a)
      a.destroy()
      b.destroy()
    }
    a.pipe(b)
    b.pipe(a)
    a.once('error', cleanup)
    b.once('error', cleanup)
    a.once('close', cleanup)
    b.once('close', cleanup)
  }

  /** Like `pipeBothWays`, but tears down the CLIENT socket once the
   *  upstream response ends — used only for the plain-HTTP forwarding
   *  path, where reusing the client connection for a second request
   *  would bypass per-request validation (see the call site above). */
  function pipeOneShotResponse(client: net.Socket, upstream: net.Socket): void {
    const cleanup = () => {
      client.unpipe(upstream)
      upstream.unpipe(client)
      client.destroy()
      upstream.destroy()
    }
    client.pipe(upstream)
    upstream.pipe(client)
    upstream.once('error', cleanup)
    client.once('error', cleanup)
    upstream.once('close', cleanup)
    upstream.once('end', cleanup)
  }

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr === null || typeof addr === 'string') {
        reject(new Error('proxy server failed to bind to a TCP port'))
        return
      }
      resolve({
        port: addr.port,
        totalConnections: () => total,
        activeConnections: () => activeConnections.size,
        close: () =>
          new Promise((res, rej) => {
            server.close((err) => (err ? rej(err) : res()))
            // Force down every still-live socket (both accepted client
            // connections and their piped remote counterparts) rather
            // than waiting for each side to notice the other went away
            // on its own — server.close()'s callback only fires once
            // every connection has actually ended, so leaving this to
            // natural teardown could hang close() indefinitely on a
            // lingering tunnel.
            for (const socket of liveSockets) socket.destroy()
          }),
      })
    })
  })
}
