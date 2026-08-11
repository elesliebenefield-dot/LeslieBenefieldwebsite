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

import type { BrowserContext, Page } from 'puppeteer-core'
import { validateCaptureUrl, type UrlSafetyFailure, type UrlSafetyDeps } from './networkSafety.js'
import { startConnectionBindingProxy, type ConnectionBindingProxy } from './connectionBindingProxy.js'
import { launchCaptureBrowser, resolveLocalChromePath, type CaptureBrowserHandle } from './browserLifecycle.js'
import { hardenPage, suppressPopups } from './pageHardening.js'
import { RAW_CAPTURE_ENVELOPE_SCHEMA_VERSION, type RawCapture, type CaptureProvenance } from '../types/rawCapture.js'

export type CaptureFailure =
  | { kind: 'unsafe-url'; error: UrlSafetyFailure }
  | { kind: 'proxy-start-failed'; reason: string }
  | { kind: 'browser-launch-failed'; reason: string }
  /** The browser process launched successfully but died (crash, OOM-kill,
   *  disconnect) before or while creating the first page — distinct from
   *  browser-launch-failed (puppeteer.launch itself rejecting). Previously
   *  this threw uncaught past captureOverflowAndReadability entirely; see
   *  the crash-diagnostics patch. */
  | { kind: 'browser-crashed'; reason: string }
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
  /** Passed through to launchCaptureBrowser. Local Chrome (dev) wants
   *  Puppeteer's default `true` (the "new" headless mode); resolveServerlessChromium's
   *  binary needs `'shell'` — see browserLifecycle.ts's crash-diagnostics
   *  patch for why this can't just be hardcoded here. */
  headless?: boolean | 'shell'
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
  /** Test-only hook, called after the browser has launched but before a
   *  context/page is created — lets tests deterministically reproduce a
   *  browser-crashed-after-launch scenario (e.g. killing the real
   *  process) against captureOverflowAndReadability's actual failure
   *  mapping, without a fragile, version-specific way to make Chromium
   *  itself crash on cue. Production never supplies this. */
  onHandleReady?: (handle: CaptureBrowserHandle) => Promise<void> | void
  /** Release-polish pass: when true, also captures the rendered page's
   *  outerHTML from the SAME already-open page used for overflow/
   *  readability — no extra navigation, no second browser. Used by
   *  api/check-visual.ts's contact-information/homepage-link fallback
   *  for pages the static check (api/check-website.ts) couldn't verify
   *  because they appear to require JavaScript rendering. Off by
   *  default: the default (no-fallback-needed) capture path is
   *  completely unaffected. */
  captureRenderedHtml?: boolean
}

/** Defensive cap — still bounded, not unbounded, but no longer sized to
 *  match api/check-website.ts's own MAX_RESPONSE_BYTES (2,000,000) for
 *  its STATIC fetch. That assumption doesn't hold for a RENDERED,
 *  hydrated page: reproduced directly against a real client-rendered
 *  site (a Vue-based storefront) whose rendered outerHTML was
 *  consistently ~2.9-3.0M characters — comfortably larger than a static
 *  HTML response because of inlined framework/hydration state and
 *  component markup, categorically different content than what
 *  MAX_RESPONSE_BYTES was calibrated for. At the old 2,000,000-char cap,
 *  that page's real navigation links (positioned later in the
 *  serialized DOM, past a large amount of preceding markup) were
 *  silently discarded before evaluateHomepageLinks ever saw them — the
 *  links fallback found zero candidates not because none existed or
 *  hadn't rendered yet, but because they were truncated away. Raised
 *  with real headroom above the observed real-world size, not an
 *  unbounded/guessed increase. */
const MAX_RENDERED_HTML_CHARS = 6_000_000

/** Bound for the single content-readiness recheck below — see its call
 *  site for why this exists. Small relative to the navigation timeout:
 *  this only ever runs on the rare zero-candidate sample, and self-
 *  terminates the moment text appears rather than waiting the full
 *  budget every time. */
const TEXT_RECHECK_TIMEOUT_MS = 2000

/** Bound for the network-idle wait below — see its call site. Same
 *  order of magnitude as TEXT_RECHECK_TIMEOUT_MS, well inside the
 *  overall navigation/capture budget; self-terminates as soon as the
 *  page's own in-flight requests settle rather than waiting the full
 *  budget every time. */
const RENDERED_HTML_SETTLE_TIMEOUT_MS = 3000

export interface CapturedEvidence {
  overflow: RawCapture<'overflow'>
  readability: RawCapture<'readability'>
  /** Present only when options.captureRenderedHtml was set AND
   *  extraction succeeded. Never sent to a client — consumed entirely
   *  server-side by api/check-visual.ts's fallback (see
   *  evaluateContactSignal/evaluateHomepageLinks in
   *  src/lib/contactLinksCheck.ts) and discarded after. If extraction
   *  fails, this is simply absent — the capture as a whole still
   *  succeeds; see the try/catch around it below. */
  renderedHtml?: string
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
  /** Smallest font size among visible text NOT identified as footer/
   *  utility content — see extractRawMeasurements below. This, not
   *  footerMinVisibleFontSizePx, is what readability classification is
   *  based on. */
  minVisibleFontSizePx: number | null
  /** Smallest font size among visible text identified as footer/utility
   *  content (copyright, legal, payment, attribution, and similar) —
   *  `null` if none was found. Carried as context only; never changes
   *  the readability outcome on its own. */
  footerMinVisibleFontSizePx: number | null
}

/**
 * Runs IN-PAGE via page.evaluate — must be self-contained (no closures
 * over Node scope).
 *
 * Release-polish pass: intentionally small footer/utility text (a
 * copyright line, a legal disclaimer) was being read as "the page's
 * text is unreadably small," even when the actual content was a
 * comfortable size — a false positive, not a real finding. Every
 * visible, non-empty text node across the whole page is still measured,
 * but each is bucketed as either "meaningful" (body copy, headings,
 * buttons, form labels, navigation — everything a visitor actually
 * needs to read, wherever on the page it lives) or "footer/utility"
 * (copyright, legal, payment, attribution, and similar supporting
 * text). Readability classification is driven ONLY by the meaningful
 * bucket's minimum; the footer bucket's minimum is carried separately,
 * purely as context (see classifyReadability). There is deliberately no
 * separate "only look inside `<main>`" step: `<nav>`/header content
 * normally lives OUTSIDE `<main>` as a sibling, and restricting the
 * meaningful scan to `<main>` would silently stop measuring it — the
 * footer/utility categorization below is what actually solves the
 * original small-footer-text problem, generically, without also having
 * to narrow where "meaningful" is allowed to be found.
 *
 * Footer/utility identification is generic, never site-specific:
 * - a semantic `<footer>` or `[role="contentinfo"]` ancestor, always;
 * - otherwise, a conservative fallback for common div-based
 *   site-builder footers — an ancestor whose class/id mentions "footer"
 *   AND which renders in roughly the bottom third of the page. The
 *   position check exists so an unrelated element that merely happens
 *   to mention "footer" in a class name, without actually behaving like
 *   one, isn't swept in by name alone.
 *
 * `<nav>`/`[role="navigation"]` is deliberately NOT treated as footer/
 * utility — small navigation, button, or form-label text is exactly the
 * kind of thing this check exists to catch, and must keep being
 * measured as meaningful content.
 */
function extractRawMeasurements(): RawMeasurements {
  const viewportWidthPx = window.innerWidth
  const documentScrollWidthPx = document.documentElement.scrollWidth

  const SKIP_SELECTOR = 'script, style, noscript, template'
  // A generically-matched (class/id) footer container only counts if it
  // renders at or past this fraction of the page's own rendered content.
  const FOOTER_POSITION_THRESHOLD = 0.7

  function isSkipped(el: Element): boolean {
    return el.closest(SKIP_SELECTOR) !== null
  }

  function isRendered(el: Element): boolean {
    const style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }

  // Collected once, in a single walk: each candidate text element's font
  // size and rendered top offset, plus the page's actual rendered content
  // extent (the furthest bottom edge among them). That extent — not
  // document.documentElement.scrollHeight — is what a "near the bottom
  // of the page" check needs: scrollHeight is stretched to at least the
  // viewport's height even for short pages (a normal CSS initial-
  // containing-block behavior), which would make a viewport-relative
  // ratio read a short page's own footer as "near the top."
  const candidates: { el: Element; fontSizePx: number; topPx: number }[] = []
  let maxContentBottomPx = 0
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.textContent && node.textContent.trim().length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })
  let node: Node | null
  while ((node = walker.nextNode())) {
    const el = (node as Text).parentElement
    if (!el || isSkipped(el) || !isRendered(el)) continue
    const fontSizePx = parseFloat(window.getComputedStyle(el).fontSize)
    if (Number.isNaN(fontSizePx)) continue
    const rect = el.getBoundingClientRect()
    const topPx = rect.top + window.scrollY
    const bottomPx = rect.bottom + window.scrollY
    if (bottomPx > maxContentBottomPx) maxContentBottomPx = bottomPx
    candidates.push({ el, fontSizePx, topPx })
  }

  function footerContainerFor(el: Element): Element | null {
    const semantic = el.closest('footer, [role="contentinfo"]')
    if (semantic) return semantic
    const generic = el.closest('[class*="footer" i], [id*="footer" i]')
    if (!generic || maxContentBottomPx === 0) return null
    const rect = generic.getBoundingClientRect()
    const topPx = rect.top + window.scrollY
    return topPx / maxContentBottomPx >= FOOTER_POSITION_THRESHOLD ? generic : null
  }

  let minVisibleFontSizePx: number | null = null
  let footerMinVisibleFontSizePx: number | null = null
  for (const { el, fontSizePx } of candidates) {
    if (footerContainerFor(el)) {
      if (footerMinVisibleFontSizePx === null || fontSizePx < footerMinVisibleFontSizePx) footerMinVisibleFontSizePx = fontSizePx
    } else {
      if (minVisibleFontSizePx === null || fontSizePx < minVisibleFontSizePx) minVisibleFontSizePx = fontSizePx
    }
  }

  return { viewportWidthPx, documentScrollWidthPx, minVisibleFontSizePx, footerMinVisibleFontSizePx }
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
    handle = await launchCaptureBrowser({
      executablePath,
      extraArgs: options.extraArgs,
      headless: options.headless,
      proxyPort: proxy.port,
      overallBudgetMs: options.overallBudgetMs,
    })
  } catch (e) {
    await proxy.close().catch(() => {})
    return { ok: false, error: { kind: 'browser-launch-failed', reason: describeThrown(e) } }
  }

  if (options.onHandleReady) await options.onHandleReady(handle)

  try {
    let context: BrowserContext
    let page: Page
    try {
      context = await handle.newIsolatedContext()
      page = await context.newPage()
    } catch (e) {
      // The browser launched (we got a handle), but died before or while
      // creating a page — a crash/OOM-kill/disconnect, not a launch
      // failure. Structured, not thrown: see the crash-diagnostics patch.
      return { ok: false, error: { kind: 'browser-crashed', reason: describeThrown(e) } }
    }

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

      if (measurements.minVisibleFontSizePx === null && measurements.footerMinVisibleFontSizePx === null) {
        // Zero text candidates found on the FIRST sample, in either
        // bucket — not just "no meaningful text" (which a real footer-
        // only page can legitimately produce), but no rendered text
        // anywhere at all. `waitUntil: 'load'` guarantees referenced
        // subresources finished; it does not guarantee that JS-driven
        // content reveal (a common theme/plugin "hide until ready"
        // pattern — see delayed-reveal.html) has already run by the time
        // this single sample was taken. Recheck once, generically: wait
        // briefly for ANY non-empty rendered text to exist, then
        // re-measure on the SAME page. A genuinely textless page simply
        // times out here and keeps its original (null) measurements —
        // this never invents content that isn't there, only gives real
        // content a bounded chance to finish appearing before concluding
        // none exists.
        try {
          await page.waitForFunction(() => (document.body?.innerText ?? '').trim().length > 0, { timeout: TEXT_RECHECK_TIMEOUT_MS })
          measurements = await page.evaluate(extractRawMeasurements)
        } catch {
          // No evidence text ever appeared within the recheck window (or
          // the recheck itself failed) — keep the original, honest
          // measurements from the first sample.
        }
      }

      let renderedHtml: string | undefined
      if (options.captureRenderedHtml) {
        // Evidenced reliability fix: the text-readiness recheck above
        // guarantees readability's OWN measurement isn't taken before any
        // text is visible, but it says nothing about content the
        // contact/homepage-links fallback specifically needs — real
        // navigable links. On JS-rendered pages, navigation/product links
        // are commonly populated by a separate async operation (e.g. a
        // client-side data fetch) that can still be in flight even after
        // ordinary page text is already visible and readability's own
        // measurement has already succeeded — reproduced directly against
        // a real client-rendered site, where readability text appeared
        // within ~300ms but the rendered HTML captured at that same
        // moment still had zero navigable links, only for both to be
        // present a few hundred milliseconds later. A bounded, generic
        // network-idle wait — not a text-visibility check, since the
        // missing content here isn't text-shaped — gives that in-flight
        // work a chance to finish before the ONE HTML snapshot the
        // fallback ever gets is taken. This never touches readability's
        // own measurement (already computed above) or its recheck, and
        // only ever runs on this fallback-only path — the default
        // (no-fallback-needed) capture does zero extra work, same as
        // before. If the page never goes idle, this simply times out and
        // capture proceeds with whatever HTML exists then — the same
        // honest "Unable to verify" outcome as if this wait didn't exist,
        // never a fabricated result.
        try {
          await page.waitForNetworkIdle({ idleTime: 500, timeout: RENDERED_HTML_SETTLE_TIMEOUT_MS })
        } catch {
          // Timed out without settling — proceed with whatever has
          // rendered so far; see the comment above.
        }
        try {
          const html = await page.evaluate(() => document.documentElement.outerHTML)
          renderedHtml = html.length > MAX_RENDERED_HTML_CHARS ? html.slice(0, MAX_RENDERED_HTML_CHARS) : html
        } catch {
          // Best-effort only: the overflow/readability capture above
          // already succeeded, so this failing must not fail the whole
          // capture — the caller (api/check-visual.ts) simply has no
          // fallback evidence to work with, same as if it were never
          // requested. See requirement 5's "preserve Unable to verify."
        }
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
        payload: {
          __brand: 'ReadabilityCapturePayload',
          minVisibleFontSizePx: measurements.minVisibleFontSizePx,
          footerMinVisibleFontSizePx: measurements.footerMinVisibleFontSizePx,
        },
        incompleteCoverage: {},
      }

      return { ok: true, value: { overflow, readability, renderedHtml } }
    } finally {
      // No context.close() here: `context` is now the browser's default
      // context (see browserLifecycle.ts's crash-diagnostics patch) —
      // puppeteer-core asserts on closing it ('Default BrowserContext
      // cannot be closed!'). Nothing is leaked: the entire browser
      // process, including its default context, is torn down by
      // handle.close() below.
      stopPopupWatch()
    }
  } finally {
    await handle.close().catch(() => {})
    await proxy.close().catch(() => {})
  }
}
