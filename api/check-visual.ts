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
import type { RebuildCheckResponse } from '../src/lib/visualCheck.js'

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
    case 'navigation-failed':
      return 'We couldn’t load that page in a browser — it may be blocking automated visits, or it took too long to respond.'
    case 'measurement-failed':
      return 'We loaded the page but couldn’t finish checking it.'
    default:
      return 'Something went wrong on our end while checking this page.'
  }
}

async function resolveExecutable(): Promise<{ executablePath: string; extraArgs?: string[] }> {
  if (process.env.VERCEL) {
    const resolved = await resolveServerlessChromium()
    return { executablePath: resolved.executablePath, extraArgs: resolved.args }
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
 * handler's logic in the test file.
 */
export async function handleCheckVisual(req: VercelRequest, res: VercelResponse, captureOverrides: Partial<CaptureOptions> = {}): Promise<void> {
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

  const { executablePath, extraArgs } = await resolveExecutable()

  const result = await captureOverflowAndReadability(normalized.toString(), {
    executablePath,
    extraArgs,
    navigationTimeoutMs: NAV_TIMEOUT_MS,
    overallBudgetMs: OVERALL_BUDGET_MS,
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

  res.status(200).json({
    ok: true,
    status: 'complete',
    finalUrl: result.value.overflow.provenance.finalUrl,
    findings: findings.map((f) => ({ checkId: f.checkId, label: f.label, detail: f.detail })),
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleCheckVisual(req, res)
}
