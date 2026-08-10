// Sub-patch 2d (practical scope reset) — per-page/per-context hardening.
// Connection-level SSRF safety is connectionBindingProxy.ts's job
// (structurally guaranteed: nothing bypasses it); this module locks down
// everything a loaded page could otherwise do that has nothing to do
// with which network address it reaches — downloads, popups, dialogs,
// permission prompts, WebSockets, and resource/request/size limits.
//
// Adapted from the pre-rebuild hardenPage pattern (CDP download denial,
// dialog auto-dismiss, popup suppression); extended with explicit
// request-count and response-size limits this sub-patch adds.
//
// Import boundary: no import from src/lib/pipeline/types/.

import type { Browser, BrowserContext, Page } from 'puppeteer-core'

export interface PageHardeningLimits {
  navigationTimeoutMs?: number
  maxTotalRequests?: number
  /**
   * Enforced against bytes Chrome has actually received (CDP
   * `Network.dataReceived`), not the `Content-Length` header — this
   * covers chunked/headerless responses correctly, since it counts real
   * transferred bytes as they arrive rather than trusting what the
   * response claims its length is. Works identically for HTTP and
   * HTTPS: CDP observes traffic AFTER Chrome's own TLS decryption, so
   * this needs no interception of the connection-binding proxy's
   * encrypted tunnel — the proxy deliberately never terminates TLS
   * (see connectionBindingProxy.ts), and this doesn't need it to.
   *
   * Enforcement is a circuit breaker, not a surgical per-response abort:
   * the moment any single request's cumulative received bytes exceed
   * the cap, `Page.stopLoading` halts the page's loading entirely. That
   * stops runaway transfer immediately and safely; it does not attempt
   * to let an otherwise-fine page continue loading its other resources
   * once one response has already gone over budget.
   */
  maxResponseBytes?: number
}

export interface HardeningCounts {
  websocketRequestsBlocked: number
  mediaRequestsBlocked: number
  requestsBlockedOverLimit: number
  responsesOverSizeLimit: number
  popupsClosed: number
}

const DEFAULT_NAV_TIMEOUT_MS = 15000
const DEFAULT_MAX_TOTAL_REQUESTS = 150
const DEFAULT_MAX_RESPONSE_BYTES = 25 * 1024 * 1024

function freshCounts(): HardeningCounts {
  return { websocketRequestsBlocked: 0, mediaRequestsBlocked: 0, requestsBlockedOverLimit: 0, responsesOverSizeLimit: 0, popupsClosed: 0 }
}

/**
 * Closes any page/target the browser context creates other than the one
 * capture is actively using — window.open()/target=_blank popups become
 * unreachable dead ends rather than a second live page. Scoped to a
 * single context (not the whole browser process), and must be removed
 * (the returned function) once the capture using it is done.
 */
export function suppressPopups(context: BrowserContext, activePage: Page): { counts: HardeningCounts; stop: () => void } {
  const counts = freshCounts()
  const browser = context.browser() as Browser
  const onTargetCreated = (target: { type: () => string; page: () => Promise<Page | null> }) => {
    if (target.type() !== 'page') return
    void target
      .page()
      .then((p) => {
        if (p && p !== activePage) {
          counts.popupsClosed++
          return p.close()
        }
        return undefined
      })
      .catch(() => {})
  }
  browser.on('targetcreated', onTargetCreated)
  return { counts, stop: () => browser.off('targetcreated', onTargetCreated) }
}

/**
 * Locks down a single page: denies downloads, auto-dismisses JS dialogs
 * (alert/confirm/prompt/beforeunload) so they can never hang navigation,
 * blocks WebSocket and media subresources outright, blocks
 * `window.open`, never grants any permission (default-deny — this
 * function calls no permission-override API at all), and enforces a
 * total-request-count cap and a best-effort response-size cap. Returns a
 * live counts snapshot function for tests/reporting.
 */
export async function hardenPage(page: Page, limits: PageHardeningLimits = {}): Promise<() => HardeningCounts> {
  const maxTotalRequests = limits.maxTotalRequests ?? DEFAULT_MAX_TOTAL_REQUESTS
  const maxResponseBytes = limits.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES
  const navigationTimeoutMs = limits.navigationTimeoutMs ?? DEFAULT_NAV_TIMEOUT_MS
  const counts = freshCounts()
  let requestCount = 0

  page.setDefaultNavigationTimeout(navigationTimeoutMs)

  await page.setRequestInterception(true)
  page.on('request', (req) => {
    void (async () => {
      try {
        const type = req.resourceType()
        if (type === 'websocket') {
          counts.websocketRequestsBlocked++
          await req.abort()
          return
        }
        if (type === 'media') {
          counts.mediaRequestsBlocked++
          await req.abort()
          return
        }
        requestCount++
        if (requestCount > maxTotalRequests) {
          counts.requestsBlockedOverLimit++
          await req.abort()
          return
        }
        await req.continue()
      } catch {
        try {
          await req.abort()
        } catch {
          /* request may already be handled */
        }
      }
    })()
  })

  page.on('dialog', (dialog) => {
    dialog.dismiss().catch(() => {})
  })

  // No permission is ever granted — Chrome's own default (deny/prompt,
  // and headless auto-denies prompts requiring a user gesture) is left
  // untouched; this function deliberately calls no
  // context.overridePermissions(...) anywhere.

  await page.evaluateOnNewDocument(() => {
    window.open = () => null
  })

  const client = await page.createCDPSession()
  try {
    await client.send('Page.setDownloadBehavior', { behavior: 'deny' })
  } catch {
    /* not fatal if unsupported on this Chrome build */
  }

  // Real transfer-size enforcement — see the maxResponseBytes doc
  // comment above for why this is CDP-level, not header-based.
  try {
    await client.send('Network.enable')
    const bytesByRequestId = new Map<string, number>()
    let stopped = false
    client.on('Network.dataReceived', (event: { requestId: string; dataLength: number }) => {
      const runningTotal = (bytesByRequestId.get(event.requestId) ?? 0) + event.dataLength
      bytesByRequestId.set(event.requestId, runningTotal)
      if (runningTotal > maxResponseBytes && !stopped) {
        stopped = true
        counts.responsesOverSizeLimit++
        void client.send('Page.stopLoading').catch(() => {})
      }
    })
  } catch {
    /* not fatal if unsupported on this Chrome build */
  }

  return () => ({ ...counts })
}
