// Vercel serverless function: POST /api/check-visual
// V2 — Rendered Visual & Usability Review.
//
// CONTAINMENT (patch v0.1.1-containment, see
// cody-projects/checker-reliability-rebuild/ — PRD/Plan Criterion #13,
// Major Step 1, Milestone 1): this route is fail-closed. It confirms the
// request method and, for every POST, returns the fixed withdrawal
// response immediately — it does not read, parse, JSON-decode, normalize,
// or otherwise inspect the request body or any submitted URL, and performs
// no DNS lookup, no browser launch, and no external network request of any
// kind. This is true for every input, including missing, malformed,
// unsafe, or private-network URL data, because none of that data is ever
// looked at.
//
// The previous, real implementation (a real headless-browser render and
// measurement) is not present anywhere in this codebase — it is preserved
// by the immutable git tag v2-pre-rebuild-baseline (commit
// 256df3c35b46f9689acf86f02feb829a8bfa09c2), which private comparison work
// can check out separately. No executable copy of it lives under api/, so
// there is no runtime path from this route to it. Restoring the public V2
// checker requires an intentional future code change (replacing this
// file's body, informed by that tagged commit) after the reliability gate
// passes — not a flag, environment variable, or toggle anywhere in this file.

import { VISUAL_CHECK_WITHDRAWN_MESSAGE } from '../src/lib/visualCheck.js'
import type { VisualCheckWithdrawn, VisualCheckFailure } from '../src/lib/visualCheck.js'

interface VercelRequest {
  method?: string
}
interface VercelResponse {
  status(code: number): VercelResponse
  json(body: VisualCheckWithdrawn | VisualCheckFailure): void
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed.' })
    return
  }

  res.status(200).json({
    ok: true,
    status: 'withdrawn',
    message: VISUAL_CHECK_WITHDRAWN_MESSAGE,
  })
}
