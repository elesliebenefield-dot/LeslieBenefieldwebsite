// Prefilled "Email My Results to Leslie" mailto: body. Extracted from
// CheckPage.tsx (release-polish pass) so it's testable directly — pure
// functions, no React/JSX — see test/emailBody.test.ts.
//
// Release-polish fix: the visual section previously always read
// "Visual & Usability Score: not available (the visual review did not
// complete)" regardless of whether the visual review actually succeeded
// — the caller always passed `null` for the visual argument, a leftover
// from when the public route was still withdrawn. This module now takes
// the first real-checker release's own RebuildCheckSuccess shape (no
// score — plain-English findings only) and only uses the
// unavailable/failure wording when the visual review genuinely didn't
// complete (visual === null).

import type { CheckSuccess, Finding, FindingBucket } from './websiteCheck.js'
import type { RebuildCheckSuccess } from './visualCheck.js'
import { REBUILD_CHECK_LABEL } from './visualCheck.js'

export const RESULTS_EMAIL = 'websitesbyleslie01@gmail.com'

// Conservative cross-client budget for a mailto: URL's total length. Some mail clients
// (notably older Outlook) truncate or reject much longer mailto links.
const MAILTO_SAFE_LENGTH = 1800

const CATEGORY_ORDER: FindingBucket[] = ['good', 'improve', 'unverified', 'specialist']

const EMAIL_SECTION_TITLE: Record<FindingBucket, string> = {
  good: 'Looking Good',
  improve: 'Opportunities to Improve',
  unverified: 'Unable to Verify Automatically',
  specialist: 'May Need Current Provider or a Specialist',
}

function truncateDetail(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const slice = text.slice(0, maxLen - 1)
  const lastSpace = slice.lastIndexOf(' ')
  const cut = lastSpace > maxLen * 0.6 ? slice.slice(0, lastSpace) : slice
  return `${cut.trimEnd()}…`
}

function checkedDomain(result: CheckSuccess): string {
  try {
    return new URL(result.finalUrl).hostname
  } catch {
    return result.finalUrl
  }
}

export interface EmailTierOptions {
  detailLimit: number | null
  includeGoodSections: boolean
  unverifiedSummaryOnly: boolean
}

// Priority order when space is tight (mirrors the fallback tiers below):
// 1. Checked URL  2. Technical score + completion count + visual status  3. Worth-reviewing findings
// 4. Specialist warnings  5. Unverified summary. "Looking good" detail is the
// first thing trimmed, since it's the least actionable content in a tight email.
export function buildCombinedEmailBody(technical: CheckSuccess, visual: RebuildCheckSuccess | null, opts: EmailTierOptions): string {
  const lines: string[] = []
  lines.push(`Website checked: ${technical.finalUrl}`)
  // Homepage availability wasn't confirmed good — see CheckUnscored in
  // websiteCheck.ts for why no score exists here at all, not just a
  // zeroed one. The email must be as honest as the results page: no
  // "0/100" or any other number standing in for "not enough was checked."
  lines.push(
    technical.status === 'scored'
      ? `Technical Basics Score: ${technical.score}/100 (${technical.checksCompleted} of ${technical.checksTotal} checks completed)`
      : `Technical Basics: Unable to complete this check (${technical.checksCompleted} of ${technical.checksTotal} checks completed) — see details below.`
  )
  lines.push(visual ? 'Visual & Usability Review: completed' : 'Visual & Usability Review: not available (the visual review did not complete)')
  lines.push('')

  function addSection(bucket: FindingBucket, title: string, items: Finding[]) {
    if (bucket === 'good' && !opts.includeGoodSections) return
    if (items.length === 0) return
    if (bucket === 'unverified' && opts.unverifiedSummaryOnly) {
      lines.push(`${title}: ${items.length} item${items.length === 1 ? '' : 's'} — see the full report on the checkup page.`)
      lines.push('')
      return
    }
    lines.push(`${title}:`)
    for (const f of items) {
      const detail = opts.detailLimit === null ? f.detail : truncateDetail(f.detail, opts.detailLimit)
      lines.push(`- ${f.label}: ${detail}`)
    }
    lines.push('')
  }

  for (const bucket of CATEGORY_ORDER) {
    addSection(bucket, EMAIL_SECTION_TITLE[bucket], technical.findings.filter((f) => f.bucket === bucket))
  }

  if (visual) {
    lines.push('Visual & Usability Review:')
    for (const f of visual.findings) {
      const detail = opts.detailLimit === null ? f.detail : truncateDetail(f.detail, opts.detailLimit)
      lines.push(`- ${REBUILD_CHECK_LABEL[f.checkId]}: ${f.label} — ${detail}`)
    }
    lines.push('')
  }

  lines.push('I’d like Leslie to review these results and let me know whether this project may be a fit for her services.')
  lines.push('')
  lines.push('Anything else I’d like Leslie to know:')
  lines.push('')
  lines.push('')

  return lines.join('\r\n')
}

export function buildMailtoHref(technical: CheckSuccess, visual: RebuildCheckSuccess | null): string {
  const subject = `Website Checkup Results — ${checkedDomain(technical)}`
  const toEncoded = (body: string) => `mailto:${RESULTS_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

  const tiers: EmailTierOptions[] = [
    { detailLimit: null, includeGoodSections: true, unverifiedSummaryOnly: false },
    { detailLimit: 70, includeGoodSections: true, unverifiedSummaryOnly: false },
    { detailLimit: 70, includeGoodSections: false, unverifiedSummaryOnly: false },
    { detailLimit: 50, includeGoodSections: false, unverifiedSummaryOnly: true },
  ]

  for (const tier of tiers) {
    const href = toEncoded(buildCombinedEmailBody(technical, visual, tier))
    if (href.length <= MAILTO_SAFE_LENGTH) return href
  }
  return toEncoded(buildCombinedEmailBody(technical, visual, tiers[tiers.length - 1]))
}
