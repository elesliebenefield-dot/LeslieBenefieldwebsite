// Sub-patch 2d (practical scope reset) — browser process lifecycle:
// launch wired to connectionBindingProxy.ts, fresh incognito context per
// capture (storage isolation between requests), and guaranteed cleanup
// on success, timeout, cancellation, and crash.
//
// Adapted from the pre-rebuild launchBrowser pattern (dev: local Chrome;
// production-shaped: @sparticuz/chromium) — same executable-resolution
// split, extended with the proxy wiring and explicit crash/hang handling
// this sub-patch adds.
//
// Import boundary: no import from src/lib/pipeline/types/ — this module
// produces nothing check-shaped, only a running browser handle.

import type { Browser, BrowserContext } from 'puppeteer-core'

export interface CaptureBrowserOptions {
  /** Absolute path to a Chrome/Chromium binary. Required — callers
   *  decide dev-vs-production resolution (see resolveLocalChromePath /
   *  resolveServerlessChromium below); this module never guesses. */
  executablePath: string
  /** Extra launch args (e.g. @sparticuz/chromium's recommended flags in
   *  production). The proxy-wiring flags below are always appended on
   *  top of these, never replaced by them. */
  extraArgs?: string[]
  /** The local connectionBindingProxy's port — every connection this
   *  browser makes is forced through it. */
  proxyPort: number
  /** Hard wall-clock budget for the whole browser process, independent
   *  of any single page's navigation timeout — if graceful close doesn't
   *  finish first, the process is force-killed when this elapses. */
  overallBudgetMs?: number
  /** Puppeteer's `headless` launch mode. Defaults to `true` (the "new"
   *  headless mode) — correct for a full desktop Chrome/Chromium binary
   *  (local dev). @sparticuz/chromium's binary is `headless_shell`,
   *  which per its own README does not support the new mode; callers
   *  using that resolution path must pass `'shell'` here instead. See
   *  resolveServerlessChromium below, which is the one place this
   *  should come from — never guessed at in this function. */
  headless?: boolean | 'shell'
}

export interface CaptureBrowserHandle {
  browser: Browser
  /** True once a 'disconnected' event has fired (crash, killed process,
   *  or a clean close already happened) — tests use this to prove crash
   *  handling doesn't hang cleanup. */
  isDisconnected(): boolean
  /** Creates a fresh incognito context — call once per logical capture
   *  within a single browser process; closing it clears all storage for
   *  that capture without needing a whole new browser. */
  newIsolatedContext(): Promise<BrowserContext>
  /** Idempotent; safe to call more than once and from a catch/finally.
   *  Always resolves (never rejects) — a failed graceful close falls
   *  back to killing the underlying process directly. */
  close(): Promise<void>
}

const DEFAULT_OVERALL_BUDGET_MS = 45000
const LOCAL_CHROME_PATH_MACOS = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

/** Dev-machine Chrome path resolution (macOS default install location).
 *  Kept separate from launchCaptureBrowser so a different OS/CI path can
 *  be supplied by the caller instead, without editing this module. */
export function resolveLocalChromePath(): string {
  return LOCAL_CHROME_PATH_MACOS
}

/** Production-shaped resolution via @sparticuz/chromium, matching the
 *  pre-rebuild pattern exactly (same package, same call shape) — never
 *  invoked by 2d's own tests, which stay on local Chrome only; provided
 *  so a real captureService (a later sub-patch) has a ready adapter.
 *
 *  `headless: 'shell'` is returned alongside the executable/args
 *  deliberately, not left for the caller to guess: every one of
 *  @sparticuz/chromium's own documented usage examples pairs its binary
 *  with `headless: 'shell'`, and its README states plainly that the
 *  `headless_shell` binary this package ships does not support
 *  Puppeteer's "new" headless mode (`headless: true`'s default meaning
 *  as of puppeteer-core v22+) — see the crash-diagnostics patch. */
export async function resolveServerlessChromium(): Promise<{ executablePath: string; args: string[]; headless: 'shell' }> {
  const chromium = (await import('@sparticuz/chromium')).default
  const executablePath = await chromium.executablePath()
  return { executablePath, args: chromium.args, headless: 'shell' }
}

/**
 * Launches a fresh browser wired to the connection-binding proxy.
 *
 * `--proxy-bypass-list=<-loopback>` is the one non-obvious flag here:
 * Chrome, by default, connects DIRECTLY to loopback/localhost
 * destinations even when a proxy is configured, silently bypassing it —
 * which would mean a redirect or subresource targeting "localhost"
 * specifically skips our validating proxy entirely and reaches it
 * unchecked. This flag removes exactly that implicit bypass rule, so
 * every destination, including loopback ones, is forced through the
 * proxy with no exception.
 */
export async function launchCaptureBrowser(options: CaptureBrowserOptions): Promise<CaptureBrowserHandle> {
  const puppeteer = (await import('puppeteer-core')).default
  const overallBudgetMs = options.overallBudgetMs ?? DEFAULT_OVERALL_BUDGET_MS

  const args = [
    ...(options.extraArgs ?? []),
    `--proxy-server=http://127.0.0.1:${options.proxyPort}`,
    '--proxy-bypass-list=<-loopback>',
    '--no-first-run',
    '--disable-component-update',
    // Reduces (does not eliminate) Chrome-internal background requests
    // (Safe Browsing updates, etc.) unrelated to the page being
    // captured — proxy-server config is global regardless of this flag,
    // so nothing here weakens the connection-binding guarantee either
    // way; this just avoids burning request-count budget on noise.
    '--disable-background-networking',
  ]

  const browser = await puppeteer.launch({
    executablePath: options.executablePath,
    args,
    headless: options.headless ?? true,
    defaultViewport: null,
    // Diagnostic only (crash-diagnostics patch): pipes Chromium's own
    // stdout/stderr into this function's, so a crash's real reason
    // (OOM, missing library, sandbox denial, ...) lands in the platform's
    // runtime logs — instead of only Puppeteer's generic "Target closed"
    // transport error, which names no cause. Nothing here is exposed to
    // a caller or a visitor; it only affects server-side log output.
    dumpio: true,
  })

  let disconnected = false
  browser.once('disconnected', () => {
    disconnected = true
  })

  const budgetTimer = setTimeout(() => {
    // Belt-and-suspenders: if something above us fails to call close()
    // within the budget (a bug, an unhandled hang), the process still
    // gets torn down rather than leaking a headless Chrome indefinitely.
    void closeHandle().catch(() => {})
  }, overallBudgetMs)
  budgetTimer.unref?.()

  async function closeHandle(): Promise<void> {
    clearTimeout(budgetTimer)
    if (disconnected) return
    try {
      await Promise.race([browser.close(), new Promise((resolve) => setTimeout(resolve, 5000))])
    } catch {
      /* fall through to process kill below */
    }
    if (!disconnected) {
      try {
        browser.process()?.kill('SIGKILL')
      } catch {
        /* already gone */
      }
    }
  }

  return {
    browser,
    isDisconnected: () => disconnected,
    newIsolatedContext: () => browser.createBrowserContext(),
    close: closeHandle,
  }
}
