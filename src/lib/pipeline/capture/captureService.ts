// First real-checker release — orchestrates the full safety-boundary-
// wrapped capture path for the two registered checks (overflow,
// readability): validates the submitted URL (networkSafety.ts), starts
// the connection-binding proxy (connectionBindingProxy.ts), launches a
// hardened browser (browserLifecycle.ts, pageHardening.ts), navigates at
// the mobile viewport, extracts raw measurements for BOTH checks from a
// single page load, and guarantees cleanup on every path. Never imported
// by api/check-visual.ts, which remains fully withdrawn.
//
// One navigation produces measurements for both checks — not two
// separate captures — since both need nothing more than one already-
// loaded, already-settled page.

import { validateCaptureUrl, type UrlSafetyFailure, type UrlSafetyDeps } from './networkSafety.js'
import { startConnectionBindingProxy, type ConnectionBindingProxy } from './connectionBindingProxy.js'
import { launchCaptureBrowser, resolveLocalChromePath, type CaptureBrowserHandle } from './browserLifecycle.js'
import { hardenPage, suppressPopups } from './pageHardening.js'
import { RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION, type RawCapture, type CaptureProvenance } from '../types/rawCapture.js'

export type CaptureFailure =
  | { kind: 'unsafe-url'; error: UrlSafetyFailure }
  | { kind: 'proxy-start-failed'; reason: string }
  | { kind: 'browser-launch-failed'; reason: string }
  | { kind: 'navigation-failed'; reason: string }
  | { kind: 'measurement-failed'; reason: string }

export interface CaptureOptions {
  /** Injectable for tests/CI — defaults to this machine's local Chrome,
   *  never @sparticuz/chromium's Lambda-only binary (matches 2d/2e's own
   *  precedent for non-production-wired code). */
  executablePath?: string
  /** Passed through to launchCaptureBrowser — e.g. @sparticuz/chromium's
   *  own recommended flags in a serverless environment. Empty locally. */
  extraArgs?: string[]
  navigationTimeoutMs?: number
  overallBudgetMs?: number
  /** Test-only DNS/classification override, threaded to BOTH the
   *  upfront URL validation and the connection-binding proxy so they
   *  agree — lets end-to-end tests point a fixture hostname at a real
   *  local server without touching real DNS or the real network.
   *  Production never supplies this. */
  deps?: UrlSafetyDeps
  /** Test-only: the local test server's own ephemeral CONNECT/HTTP
   *  ports, threaded to the proxy's own independent port allowlist
   *  (separate from deps.allowedPorts above, which only covers the
   *  upfront URL check). Production never supplies these — the proxy's
   *  real defaults (443/80) apply. */
  allowedConnectPort?: number
  allowedHttpPort?: number
}

export interface CapturedEvidence {
  overflow: RawCapture<'overflow'>
  readability: RawCapture<'readability'>
}

export type CaptureResult = { ok: true; value: CapturedEvidence } | { ok: false; error: CaptureFailure }

const MOBILE_VIEWPORT = { name: 'mobile' as const, width: 390, height: 844 }

function describeThrown(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`.slice(0, 500)
  return `non-Error thrown value of type ${typeof e}`
}

interface RawMeasurements {
  viewportWidthPx: number
  documentScrollWidthPx: number
  minVisibleFontSizePx: number | null
}

/**
 * Runs IN-PAGE via page.evaluate — must be self-contained (no closures
 * over Node scope). Walks visible, non-empty text nodes to find the
 * smallest rendered font size; `null` if none could be measured (an
 * honest "couldn't determine," not coerced to 0).
 */
function extractRawMeasurements(): RawMeasurements {
  const viewportWidthPx = window.innerWidth
  const documentScrollWidthPx = document.documentElement.scrollWidth

  let minVisibleFontSizePx: number | null = null
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.textContent && node.textContent.trim().length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })
  let node: Node | null
  while ((node = walker.nextNode())) {
    const el = (node as Text).parentElement
    if (!el) continue
    const style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    const fontSizePx = parseFloat(style.fontSize)
    if (!Number.isNaN(fontSizePx) && (minVisibleFontSizePx === null || fontSizePx < minVisibleFontSizePx)) {
      minVisibleFontSizePx = fontSizePx
    }
  }

  return { viewportWidthPx, documentScrollWidthPx, minVisibleFontSizePx }
}

export async function captureOverflowAndReadability(rawUrl: string, options: CaptureOptions = {}): Promise<CaptureResult> {
  const validated = await validateCaptureUrl(rawUrl, options.deps)
  if (!validated.ok) return { ok: false, error: { kind: 'unsafe-url', error: validated.error } }

  let proxy: ConnectionBindingProxy
  try {
    proxy = await startConnectionBindingProxy({ deps: options.deps, allowedConnectPort: options.allowedConnectPort, allowedHttpPort: options.allowedHttpPort })
  } catch (e) {
    return { ok: false, error: { kind: 'proxy-start-failed', reason: describeThrown(e) } }
  }

  let handle: CaptureBrowserHandle
  try {
    const executablePath = options.executablePath ?? resolveLocalChromePath()
    handle = await launchCaptureBrowser({ executablePath, extraArgs: options.extraArgs, proxyPort: proxy.port, overallBudgetMs: options.overallBudgetMs })
  } catch (e) {
    await proxy.close().catch(() => {})
    return { ok: false, error: { kind: 'browser-launch-failed', reason: describeThrown(e) } }
  }

  try {
    const context = await handle.newIsolatedContext()
    const page = await context.newPage()
    const { stop: stopPopupWatch } = suppressPopups(context, page)
    try {
      await hardenPage(page, { navigationTimeoutMs: options.navigationTimeoutMs })
      await page.setViewport({ width: MOBILE_VIEWPORT.width, height: MOBILE_VIEWPORT.height })

      let finalUrl: string
      try {
        const response = await page.goto(validated.value.url.toString(), { waitUntil: 'load', timeout: options.navigationTimeoutMs ?? 15000 })
        finalUrl = response?.url() ?? page.url()
      } catch (e) {
        return { ok: false, error: { kind: 'navigation-failed', reason: describeThrown(e) } }
      }

      let measurements: RawMeasurements
      try {
        measurements = await page.evaluate(extractRawMeasurements)
      } catch (e) {
        return { ok: false, error: { kind: 'measurement-failed', reason: describeThrown(e) } }
      }

      const capturedAt = new Date().toISOString()
      const provenance: CaptureProvenance = { capturedAt, viewport: { name: MOBILE_VIEWPORT.name, width: MOBILE_VIEWPORT.width, height: MOBILE_VIEWPORT.height }, finalUrl }

      const overflow: RawCapture<'overflow'> = {
        envelopeSchemaVersion: RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION,
        checkId: 'overflow',
        payloadSchemaVersion: '1.0.0',
        provenance,
        payload: { __brand: 'OverflowCapturePayload', viewportWidthPx: measurements.viewportWidthPx, documentScrollWidthPx: measurements.documentScrollWidthPx },
        incompleteCoverage: {},
      }
      const readability: RawCapture<'readability'> = {
        envelopeSchemaVersion: RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION,
        checkId: 'readability',
        payloadSchemaVersion: '1.0.0',
        provenance,
        payload: { __brand: 'ReadabilityCapturePayload', minVisibleFontSizePx: measurements.minVisibleFontSizePx },
        incompleteCoverage: {},
      }

      return { ok: true, value: { overflow, readability } }
    } finally {
      stopPopupWatch()
      await context.close().catch(() => {})
    }
  } finally {
    await handle.close().catch(() => {})
    await proxy.close().catch(() => {})
  }
}
