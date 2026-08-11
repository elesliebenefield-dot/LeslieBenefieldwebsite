// Shared between the browser (CheckPage) and the serverless function (api/check-website).
// Keep this file free of Node-only or DOM-only APIs so it works in both environments.

// 'unverified' is for checks the tool genuinely could not assess (e.g. a page that
// renders its content via browser scripts) — distinct from 'improve', which means we
// checked and found something worth fixing.
export type FindingBucket = 'good' | 'improve' | 'specialist' | 'unverified'

export interface Finding {
  id: string
  label: string
  bucket: FindingBucket
  detail: string
}

export interface CheckSuccess {
  ok: true
  input: string
  finalUrl: string
  score: number
  summary: string
  findings: Finding[]
  checksCompleted: number
  checksTotal: number
  /** Pre-rounding numerator/denominator behind `score`
   *  (`score = round((rawScore / possiblePoints) * 100)`), exposed so a
   *  later contact/homepage-links fallback resolution (see
   *  api/check-visual.ts, CheckPage.tsx) can correctly renormalize the
   *  displayed score after replacing an 'unverified' finding — using
   *  the exact same formula server-side scoring already applies,
   *  without re-implementing any check's detection/threshold logic on
   *  the client. */
  rawScore: number
  possiblePoints: number
}

export interface CheckFailure {
  ok: false
  error: string
}

export type CheckResponse = CheckSuccess | CheckFailure

/**
 * Turns ordinary user input ("example.com", "www.example.com", "https://example.com")
 * into a normalized URL, or returns null if the input can't reasonably be a public
 * website address. This is a first-pass UX check only — the server performs the
 * authoritative safety validation before making any request.
 */
export function normalizeWebsiteUrl(raw: string): URL | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  let candidate = trimmed
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`
  }

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  const hostname = url.hostname.toLowerCase()
  if (!hostname) return null
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    return null
  }

  const isIpLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':')
  if (!isIpLiteral && !hostname.includes('.')) return null

  return url
}
