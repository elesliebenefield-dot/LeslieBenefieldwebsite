// Vercel serverless function: POST /api/check-visual
// V2 — first real-checker release (overflow + readability).
//
// Restores a real URL-submission path after Milestone 1's containment
// (patch v0.1.1-containment). This route now runs the rebuild's own
// overflow and readability checks through the full 2d safety boundary
// (network validation, connection-binding proxy, hardened browser,
// isolated context) via captureService.ts. It deliberately does NOT
// restore the old, withdrawn V2 checker (score, 12 checks,
// VISUAL_CHECK_WEIGHTS) — that implementation is not present anywhere in
// this codebase (see the v2-pre-rebuild-baseline tag). This is a
// genuinely narrower, honest replacement: two checks, plain-English
// outcomes, no score, no automatic rejection.
//
// Nothing submitted here is stored — each request captures a fresh,
// isolated browser context, and the result is computed and returned in a
// single request/response cycle.

import { normalizeWebsiteUrl } from '../src/lib/websiteCheck.js'
import { captureOverflowAndReadability, type CaptureFailure, type CaptureOptions } from '../src/lib/pipeline/capture/captureService.js'
import { resolveLocalChromePath, resolveServerlessChromium } from '../src/lib/pipeline/capture/browserLifecycle.js'
import { normalizeOverflowEvidence, normalizeReadabilityEvidence } from '../src/lib/pipeline/normalize/evidenceNormalizer.js'
import { classifyOverflow, classifyReadability } from '../src/lib/pipeline/classify/classificationEngine.js'
import { getOverflowContract, getReadabilityContract } from '../src/lib/pipeline/classify/contractRegistry.js'
import { presentOverflowFindings, presentReadabilityFindings } from '../src/lib/pipeline/present/findingsPresenter.js'
import { evaluateContactSignal, evaluateHomepageLinks, CONTACT_POINTS, LINKS_POINTS, type ContactLinksDeps } from '../src/lib/contactLinksCheck.js'
import type { RebuildCheckResponse, TechnicalFallbackResult } from '../src/lib/visualCheck.js'

const NAV_TIMEOUT_MS = 18000
const OVERALL_BUDGET_MS = 45000

interface VercelRequest {
  method?: string
  body?: unknown
}
interface VercelResponse {
  status(code: number): VercelResponse
  json(body: RebuildCheckResponse): void
}

/** Plain-English, never exposes the internal failure kind/stack. */
function friendlyErrorFor(error: CaptureFailure): string {
  switch (error.kind) {
    case 'unsafe-url':
      return 'That website address isn’t supported.'
    case 'browser-crashed':
      return 'This page couldn’t be checked right now — the checker closed unexpectedly. Please try again in a moment.'
    case 'navigation-failed':
      return 'We couldn’t load that page in a browser — it may be blocking automated visits, or it took too long to respond.'
    case 'measurement-failed':
      return 'We loaded the page but couldn’t finish checking it.'
    default:
      return 'Something went wrong on our end while checking this page.'
  }
}

async function resolveExecutable(): Promise<{ executablePath: string; extraArgs?: string[]; headless?: boolean | 'shell' }> {
  if (process.env.VERCEL) {
    const resolved = await resolveServerlessChromium()
    return { executablePath: resolved.executablePath, extraArgs: resolved.args, headless: resolved.headless }
  }
  return { executablePath: resolveLocalChromePath() }
}

/**
 * The routed handler's real logic. Takes an optional `captureOverrides` —
 * unused in production (the default export below never supplies it) —
 * so tests can point the exact same request/response path at a local
 * fixture server via captureService's own `deps`/`allowedHttpPort`/
 * `allowedConnectPort` injection (the same pattern already used by
 * test/pipeline.captureService.test.ts), instead of re-implementing this
 * handler's logic in the test file. `contactLinksDeps` is the same
 * test-only override for the contact/links fallback's OWN, separate
 * safety boundary (src/lib/contactLinksCheck.ts's assertSafeUrl/
 * checkLink — real DNS + fetch, not the capture pipeline's proxy).
 */
export async function handleCheckVisual(
  req: VercelRequest,
  res: VercelResponse,
  captureOverrides: Partial<CaptureOptions> = {},
  contactLinksDeps: ContactLinksDeps = {}
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' })
    return
  }

  let rawUrl: unknown
  let needsContactFallback = false
  let needsLinksFallback = false
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const parsed = body as { url?: unknown; needsContactFallback?: unknown; needsLinksFallback?: unknown } | null
    rawUrl = parsed?.url
    needsContactFallback = parsed?.needsContactFallback === true
    needsLinksFallback = parsed?.needsLinksFallback === true
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

  const { executablePath, extraArgs, headless } = await resolveExecutable()

  const result = await captureOverflowAndReadability(normalized.toString(), {
    executablePath,
    extraArgs,
    headless,
    navigationTimeoutMs: NAV_TIMEOUT_MS,
    overallBudgetMs: OVERALL_BUDGET_MS,
    // Only the SAME already-open page's rendered HTML is captured, and
    // only when a fallback was actually requested — the default
    // (no-fallback-needed) path does no extra work at all. No second
    // browser, no extra navigation. See captureService.ts.
    captureRenderedHtml: needsContactFallback || needsLinksFallback,
    ...captureOverrides,
  })

  if (!result.ok) {
    res.status(200).json({ ok: false, error: friendlyErrorFor(result.error) })
    return
  }

  const overflowEvidence = normalizeOverflowEvidence(result.value.overflow)
  const overflowClassification = classifyOverflow({ evidence: overflowEvidence, contract: getOverflowContract() })
  const readabilityEvidence = normalizeReadabilityEvidence(result.value.readability)
  const readabilityClassification = classifyReadability({ evidence: readabilityEvidence, contract: getReadabilityContract() })

  const findings = [...presentOverflowFindings(overflowClassification), ...presentReadabilityFindings(readabilityClassification)]

  // Technical Basics 'contact'/'links' fallback — only attempted when
  // requested, and only using the rendered HTML from the browser page
  // already captured above (never a second browser, never a new
  // navigation). Uses the exact same detection/scoring functions
  // api/check-website.ts's own static path uses — see
  // src/lib/contactLinksCheck.ts.
  let contactFallback: TechnicalFallbackResult | undefined
  let linksFallback: TechnicalFallbackResult | undefined
  const renderedHtml = result.value.renderedHtml
  if (renderedHtml) {
    const finalUrl = result.value.overflow.provenance.finalUrl
    if (needsContactFallback) {
      const evaluated = evaluateContactSignal(renderedHtml)
      contactFallback = { finding: evaluated.finding, points: evaluated.points, possiblePointsRestored: CONTACT_POINTS }
    }
    if (needsLinksFallback) {
      const evaluated = await evaluateHomepageLinks(renderedHtml, finalUrl, contactLinksDeps)
      // null means still not enough safe link candidates even after
      // rendering — leave linksFallback undefined so the client keeps
      // its existing "Unable to verify" result rather than a fabricated one.
      if (evaluated) linksFallback = { finding: evaluated.finding, points: evaluated.points, possiblePointsRestored: LINKS_POINTS }
    }
  }

  res.status(200).json({
    ok: true,
    status: 'complete',
    finalUrl: result.value.overflow.provenance.finalUrl,
    findings: findings.map((f) => ({ checkId: f.checkId, label: f.label, detail: f.detail })),
    ...(contactFallback ? { contactFallback } : {}),
    ...(linksFallback ? { linksFallback } : {}),
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleCheckVisual(req, res)
}
