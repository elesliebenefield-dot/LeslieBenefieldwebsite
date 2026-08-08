// Vercel serverless function: POST /api/check-visual
// V2 — Rendered Visual & Usability Review. Runs a real (headless) browser against
// the submitted homepage at desktop and mobile widths and measures rendered-page
// issues. This is entirely separate from V1 (api/check-website.ts), which is not
// imported or modified by this file.
//
// Nothing submitted or rendered here is stored — screenshots, HTML, and page
// content are discarded once the report is computed. Each request launches its
// own fresh browser, closed in every success/failure path; each viewport check
// gets its own page with cookies cleared beforehand, so no check's state can
// leak into another.

import { randomUUID } from 'node:crypto'
import type { Browser, Page, Target } from 'puppeteer-core'
import { assertSafeUrl, createHostnameSafetyCache, UnsafeUrlError } from '../src/lib/urlSafety.js'
import { normalizeWebsiteUrl } from '../src/lib/websiteCheck.js'
import { collectPageMeasurements, type RawMeasurements } from '../src/lib/visualAnalysis.js'
import { buildVisualReport } from '../src/lib/visualScoring.js'
import { scrollThroughPageAndSettle } from '../src/lib/scrollSettle.js'
import type { VisualCheckResponse, DiagnosticStage } from '../src/lib/visualCheck.js'
import { VISUAL_CHECK_COUNT } from '../src/lib/visualCheck.js'

/** Tracks the last major stage reached, for safe preview-only diagnostics (see the
 *  catch block in `handler`). A plain mutable holder, not persisted or logged anywhere
 *  except this one request's own error path. */
type Stage = { current: DiagnosticStage }

const NAV_TIMEOUT_MS = 18000
const SETTLE_MS = 900
const MOBILE_SETTLE_MS = 500
const OVERALL_DEADLINE_MS = 42000 // headroom under the 55s function maxDuration
const LOCAL_CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const DESKTOP_VIEWPORT = { width: 1440, height: 900 }
const MOBILE_VIEWPORT = { width: 390, height: 844 }

function withDeadline<T>(promise: Promise<T>, ms: number, onTimeoutMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(onTimeoutMessage)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>
}

async function launchBrowser(stage: Stage): Promise<Browser> {
  const puppeteer = (await import('puppeteer-core')).default

  if (process.env.VERCEL) {
    stage.current = 'resolving-chromium'
    const chromium = (await import('@sparticuz/chromium')).default
    const executablePath = await chromium.executablePath()

    stage.current = 'launching-browser'
    return puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
      defaultViewport: DESKTOP_VIEWPORT,
    })
  }

  // Local development: use the machine's installed Chrome instead of the
  // Lambda-specific @sparticuz/chromium binary, which only runs on Linux.
  stage.current = 'launching-browser'
  return puppeteer.launch({
    executablePath: LOCAL_CHROME_PATH,
    headless: true,
    defaultViewport: DESKTOP_VIEWPORT,
  })
}

/** Locks down what a page is allowed to do: safe navigation/subresources only, no
 *  downloads, no popups, no dialogs, no permission grants — and, since viewport
 *  checks now share the browser's default context rather than each getting its
 *  own incognito context, clears any cookies left over from a prior check. */
async function hardenPage(page: Page): Promise<void> {
  const isUrlSafe = createHostnameSafetyCache()

  await page.setRequestInterception(true)
  page.on('request', (req) => {
    void (async () => {
      try {
        const type = req.resourceType()
        // Only block what's explicitly unneeded (media, websockets). Chrome sometimes
        // classifies legitimate CSS background-images/preloads as 'other' — blocking
        // that type too aggressively breaks real layout, so it goes through the normal
        // safety check below instead of being blanket-blocked.
        if (type === 'media' || type === 'websocket') {
          await req.abort()
          return
        }
        const safe = await isUrlSafe(req.url())
        if (!safe) {
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

  const client = await page.createCDPSession()
  try {
    await client.send('Page.setDownloadBehavior', { behavior: 'deny' })
  } catch {
    /* not fatal if unsupported */
  }
  try {
    await client.send('Network.clearBrowserCookies')
  } catch {
    /* not fatal if unsupported */
  }

  // Prevent popups/new windows from doing anything meaningful.
  await page.evaluateOnNewDocument(() => {
    window.open = () => null
  })
}

async function measureViewport(
  browser: Browser,
  url: string,
  viewport: { width: number; height: number },
  label: 'desktop' | 'mobile',
  stage: Stage
): Promise<RawMeasurements | null> {
  stage.current = 'creating-page'
  const page = await browser.newPage()

  // Immediately close any popup/new tab a page tries to open. Scoped to the
  // browser (there's no per-check context anymore) and removed again in
  // `finally`, so it only applies while this specific viewport check is active.
  const onTargetCreated = (target: Target) => {
    if (target.type() === 'page' && target.page) {
      target
        .page()
        .then((p) => {
          if (p && p !== page) p.close().catch(() => {})
        })
        .catch(() => {})
    }
  }
  browser.on('targetcreated', onTargetCreated)

  try {
    await page.setViewport(viewport)
    await hardenPage(page)

    stage.current = 'navigating'
    try {
      await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS })
    } catch {
      return null
    }
    try {
      await scrollThroughPageAndSettle(page)
    } catch {
      // Non-fatal — proceed with whatever had a chance to load/settle.
    }
    await new Promise((r) => setTimeout(r, label === 'desktop' ? SETTLE_MS : MOBILE_SETTLE_MS))

    stage.current = 'analyzing-page'
    const measurements = await page.evaluate(collectPageMeasurements, label)
    return measurements
  } catch {
    return null
  } finally {
    browser.off('targetcreated', onTargetCreated)
    await page.close().catch(() => {})
  }
}

interface VercelRequest {
  method?: string
  body?: unknown
}
interface VercelResponse {
  status(code: number): VercelResponse
  json(body: VisualCheckResponse): void
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' })
    return
  }

  let rawUrl: unknown
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    rawUrl = (body as { url?: unknown } | null)?.url
  } catch {
    res.status(400).json({ ok: false, error: 'Please enter a valid website address.' })
    return
  }

  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    res.status(400).json({ ok: false, error: 'Please enter a website address.' })
    return
  }

  const normalized = normalizeWebsiteUrl(rawUrl)
  if (!normalized) {
    res.status(400).json({ ok: false, error: 'That doesn’t look like a valid website address. Try something like yourbusiness.com.' })
    return
  }

  try {
    await assertSafeUrl(normalized)
  } catch (err) {
    const message = err instanceof UnsafeUrlError ? err.message : 'That website address isn’t supported.'
    res.status(400).json({ ok: false, error: message })
    return
  }

  const stage: Stage = { current: 'validating-request' }
  let browser: Browser | null = null
  try {
    const targetUrl = normalized.toString()

    const result = await withDeadline(
      (async () => {
        browser = await launchBrowser(stage)
        const desktop = await measureViewport(browser!, targetUrl, DESKTOP_VIEWPORT, 'desktop', stage)
        const mobile = await measureViewport(browser!, targetUrl, MOBILE_VIEWPORT, 'mobile', stage)
        return { desktop, mobile }
      })(),
      OVERALL_DEADLINE_MS,
      'The visual review took too long to complete.'
    )

    stage.current = 'building-report'
    const finalUrl = normalized.toString()
    const report = buildVisualReport(result.desktop, result.mobile)

    const summary =
      result.desktop === null && result.mobile === null
        ? 'This website could not be rendered for a visual review.'
        : report.score >= 85
          ? 'The rendered page looks solid overall, with just a few small things worth a look.'
          : report.score >= 65
            ? 'The rendered page is workable overall, with some room to improve.'
            : report.score >= 40
              ? 'A few rendered-page issues could be affecting visitors.'
              : 'Several rendered-page issues were found — a closer look would likely help.'

    const response: VisualCheckResponse = {
      ok: true,
      finalUrl,
      score: report.score,
      summary,
      findings: report.findings.map(({ id, label, bucket, viewport, detail, measurable }) => ({
        id,
        label,
        bucket,
        viewport,
        detail,
        measurable,
      })),
      checksCompleted: report.checksCompleted,
      checksTotal: VISUAL_CHECK_COUNT,
    }
    res.status(200).json(response)
  } catch (err) {
    // Log full detail server-side only (visible in Vercel's function logs) — the
    // visitor gets a friendly message plus a short reference id for correlation,
    // never the raw error text, which could contain internal paths/stack details.
    const errorRef = randomUUID().slice(0, 8)
    console.error(`[check-visual:${errorRef}] stage=${stage.current}`, err)

    // Preview-only, whitelisted diagnostic: a fixed stage name, never anything
    // derived from the actual error (no messages, paths, stack traces, URLs).
    // Production responses never include this field at all.
    const isPreview = process.env.VERCEL_ENV === 'preview'

    res.status(200).json({
      ok: true,
      finalUrl: normalized.toString(),
      score: 0,
      summary: 'This website could not be rendered for a visual review.',
      findings: [
        {
          id: 'render',
          label: 'Rendered page review',
          bucket: 'unverified',
          viewport: 'both',
          detail: `We couldn’t complete a rendered visual review of this site (reference: ${errorRef}). That does not necessarily mean anything is wrong — some sites block automated visits.`,
          measurable: false,
        },
      ],
      checksCompleted: 0,
      checksTotal: VISUAL_CHECK_COUNT,
      diagnosticStage: isPreview ? stage.current : undefined,
    })
  } finally {
    if (browser) {
      await (browser as Browser).close().catch(() => {})
    }
  }
}
