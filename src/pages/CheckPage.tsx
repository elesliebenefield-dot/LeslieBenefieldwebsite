import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import beachBg from '../assets/backgrounds/beach-background.jpeg'
import { normalizeWebsiteUrl } from '../lib/websiteCheck'
import type { CheckResponse, CheckSuccess, Finding, FindingBucket } from '../lib/websiteCheck'
import type { VisualCheckResponse, VisualCheckSuccess, VisualFinding, VisualFindingBucket } from '../lib/visualCheck'

const RESULTS_EMAIL = 'websitesbyleslie01@gmail.com'

type Status = 'idle' | 'loading' | 'success' | 'error'

const WHAT_WE_CHECK = [
  'Whether your homepage uses a secure (HTTPS) connection',
  'Whether your homepage responds and roughly how long it takes',
  'Whether your homepage has a page title',
  'Whether your homepage has a meta description',
  'Whether a mobile viewport setting is present',
  'Whether visible contact information can be found',
  'A small sample of links found on your homepage',
]

const CATEGORY_ORDER: FindingBucket[] = ['good', 'improve', 'unverified', 'specialist']

const CATEGORY_INFO: Record<FindingBucket, { title: string; description: string }> = {
  good: {
    title: 'Looking good',
    description: 'No action appears necessary based on this check.',
  },
  improve: {
    title: 'Worth improving',
    description: 'Common small-business website issues Leslie may be able to help with.',
  },
  unverified: {
    title: 'Unable to verify automatically',
    description:
      'This website loads some content through browser scripts, so this automated check could not verify every item. That does not necessarily mean anything is wrong.',
  },
  specialist: {
    title: 'May need your current provider or a specialist',
    description: 'Outside the normal scope of this automated check — often hosting, security, or platform-specific.',
  },
}

const SCOPE_NOTICE =
  'Designed primarily for informational and service-based small-business websites. Results may be limited for marketplace shops and complex ecommerce sites, including Etsy, Shopify, Square Online, WooCommerce, and similar platforms.'

const EMAIL_SECTION_TITLE: Record<FindingBucket, string> = {
  good: 'Looking Good',
  improve: 'Worth Improving',
  unverified: 'Unable to Verify Automatically',
  specialist: 'May Need Current Provider or a Specialist',
}

const VISUAL_CATEGORY_ORDER: VisualFindingBucket[] = ['good', 'improve', 'unverified', 'specialist']

const VISUAL_CATEGORY_INFO: Record<VisualFindingBucket, { title: string; description: string }> = {
  good: {
    title: 'Visual checks looking good',
    description: 'No action appears necessary based on this rendered-page check.',
  },
  improve: {
    title: 'Visual items worth reviewing',
    description: 'Measurable rendered-page issues, or heuristic suggestions worth a manual look.',
  },
  unverified: {
    title: 'Unable to verify automatically',
    description: 'This page couldn’t be fully rendered or measured for these items. That does not necessarily mean anything is wrong.',
  },
  specialist: {
    title: 'May need your current provider or a specialist',
    description: 'Outside the normal scope of this automated check — often platform-specific.',
  },
}

const WHAT_WE_CHECK_VISUAL = [
  'Whether the page causes unintended horizontal scrolling on desktop or mobile',
  'Whether visible content appears clipped, overlapping, or hidden behind a fixed header',
  'Whether navigation is present and usable on desktop and mobile',
  'Logo and header proportions in the rendered page',
  'Text size, line spacing, line length, and estimated contrast',
  'Whether tappable buttons and links are reasonably sized and spaced on mobile',
  'Whether rendered images loaded correctly and look proportional',
  'Whether a clear heading and next step are visible near the top of the page',
  'Whether a visible action or contact path is present',
  'Heading structure (a single clear H1, reasonable order)',
  'Whether a footer copyright notice looks well-formed',
  'Whether fixed banners, popups, or widgets obstruct a large part of the mobile screen',
]

const VISUAL_EMAIL_SECTION_TITLE: Record<VisualFindingBucket, string> = {
  good: 'Visual — Looking Good',
  improve: 'Visual — Worth Reviewing',
  unverified: 'Visual — Unable to Verify',
  specialist: 'Visual — May Need a Specialist',
}

// Conservative cross-client budget for a mailto: URL's total length. Some mail clients
// (notably older Outlook) truncate or reject much longer mailto links.
const MAILTO_SAFE_LENGTH = 1800

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

interface EmailTierOptions {
  detailLimit: number | null
  includeGoodSections: boolean
  unverifiedSummaryOnly: boolean
}

// Priority order when space is tight (mirrors the fallback tiers below):
// 1. Checked URL  2. Both scores + completion counts  3. Worth-reviewing findings
// 4. Specialist warnings  5. Unverified summary. "Looking good" detail is the
// first thing trimmed, since it's the least actionable content in a tight email.
function buildCombinedEmailBody(technical: CheckSuccess, visual: VisualCheckSuccess | null, opts: EmailTierOptions): string {
  const lines: string[] = []
  lines.push(`Website checked: ${technical.finalUrl}`)
  lines.push(`Technical Basics Score: ${technical.score}/100 (${technical.checksCompleted} of ${technical.checksTotal} checks completed)`)
  lines.push(
    visual
      ? `Visual & Usability Score: ${visual.score}/100 (${visual.checksCompleted} of ${visual.checksTotal} checks completed)`
      : 'Visual & Usability Score: not available (the visual review did not complete)'
  )
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
    function addVisualSection(bucket: VisualFindingBucket, title: string, items: VisualFinding[]) {
      if (bucket === 'good' && !opts.includeGoodSections) return
      if (items.length === 0) return
      if (bucket === 'unverified' && opts.unverifiedSummaryOnly) {
        lines.push(`${title}: ${items.length} item${items.length === 1 ? '' : 's'} — see the full report on the checkup page.`)
        lines.push('')
        return
      }
      lines.push(`${title}:`)
      for (const f of items) {
        const viewportTag = f.viewport !== 'both' ? ` (${f.viewport})` : ''
        const detail = opts.detailLimit === null ? f.detail : truncateDetail(f.detail, opts.detailLimit)
        lines.push(`- ${f.label}${viewportTag}: ${detail}`)
      }
      lines.push('')
    }
    for (const bucket of VISUAL_CATEGORY_ORDER) {
      addVisualSection(bucket, VISUAL_EMAIL_SECTION_TITLE[bucket], visual.findings.filter((f) => f.bucket === bucket))
    }
  }

  lines.push('I’d like Leslie to review these results and let me know whether this project may be a fit for her services.')
  lines.push('')
  lines.push('Anything else I’d like Leslie to know:')
  lines.push('')
  lines.push('')

  return lines.join('\r\n')
}

function buildMailtoHref(technical: CheckSuccess, visual: VisualCheckSuccess | null): string {
  const subject = `Website Checkup Results — ${checkedDomain(technical)}`
  const toEncoded = (body: string) =>
    `mailto:${RESULTS_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

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

function scoreLabel(score: number): string {
  if (score >= 85) return 'Looking strong'
  if (score >= 65) return 'Solid, with room to improve'
  if (score >= 40) return 'A few things to address'
  return 'Needs attention'
}

const CheckIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const FlagIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="2" x2="12" y2="22" />
    <path d="M12 4h7l-2 4 2 4h-7" />
  </svg>
)

const ArrowIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 17 17 7" />
    <path d="M7 7h10v10" />
  </svg>
)

const QuestionIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.25a2.5 2.5 0 0 1 4.83.9c0 1.67-2.33 2.1-2.33 3.35" />
    <line x1="12" y1="16.7" x2="12" y2="16.71" />
  </svg>
)

const BUCKET_ICON: Record<FindingBucket, () => JSX.Element> = {
  good: CheckIcon,
  improve: FlagIcon,
  unverified: QuestionIcon,
  specialist: ArrowIcon,
}

function FindingRow({ finding }: { finding: Finding }) {
  const Icon = BUCKET_ICON[finding.bucket]
  return (
    <li className={`checkup-finding checkup-finding--${finding.bucket}`}>
      <span className="checkup-finding-icon" aria-hidden="true">
        <Icon />
      </span>
      <span>
        <span className="checkup-finding-label">{finding.label}</span>
        <span className="checkup-finding-detail">{finding.detail}</span>
      </span>
    </li>
  )
}

function VisualFindingRow({ finding }: { finding: VisualFinding }) {
  const Icon = BUCKET_ICON[finding.bucket]
  const viewportLabel = finding.viewport === 'both' ? 'Desktop & mobile' : finding.viewport === 'desktop' ? 'Desktop' : 'Mobile'
  return (
    <li className={`checkup-finding checkup-finding--${finding.bucket}`}>
      <span className="checkup-finding-icon" aria-hidden="true">
        <Icon />
      </span>
      <span>
        <span className="checkup-finding-label">{finding.label}</span>
        <span className="checkup-finding-meta">
          {viewportLabel} · {finding.measurable ? 'Measured' : 'Suggested — manual review'}
        </span>
        <span className="checkup-finding-detail">{finding.detail}</span>
      </span>
    </li>
  )
}

type VisualStatus = 'idle' | 'loading' | 'success' | 'error'

function VisualSection({
  status,
  result,
  errorMessage,
}: {
  status: VisualStatus
  result: VisualCheckSuccess | null
  errorMessage: string | null
}) {
  const grouped: Record<VisualFindingBucket, VisualFinding[]> = { good: [], improve: [], unverified: [], specialist: [] }
  if (result) {
    for (const finding of result.findings) grouped[finding.bucket].push(finding)
  }
  const ecommerceFinding = result?.findings.find((f) => f.id === 'ecommerce-visual')

  return (
    <div className="checkup-visual-section">
      <h2 className="section-title checkup-results-title checkup-visual-title">Visual &amp; Usability Review</h2>
      <p className="checkup-visual-intro">
        A real browser opens your homepage at desktop and mobile widths and checks for measurable rendered-page
        issues. This is a separate review from the Technical Basics Score above — the two are not combined into
        one overall score.
      </p>

      {(status === 'loading' || status === 'idle') && (
        <div className="checkup-loading" role="status">
          <span className="checkup-spinner" aria-hidden="true" />
          Rendering your website in a browser at desktop and mobile widths — this can take up to a minute…
        </div>
      )}

      {status === 'error' && (
        <div className="checkup-api-error" role="alert">
          <strong>The visual review couldn’t run.</strong>
          <p>
            {errorMessage ??
              'Something went wrong on our end while rendering this page. Your Technical Basics results above are unaffected.'}
          </p>
        </div>
      )}

      {status === 'success' && result && (
        <>
          <p className="checkup-score-eyebrow">Visual &amp; Usability Score</p>
          <div className="checkup-score-row">
            <div className="checkup-score">
              <span className="checkup-score-number">{result.score}</span>
              <span className="checkup-score-max">/100</span>
            </div>
            <div>
              <p className="checkup-score-label">{scoreLabel(result.score)}</p>
              <p className="checkup-summary">{result.summary}</p>
              <p className="checkup-checks-count">
                {result.checksCompleted} of {result.checksTotal} visual checks completed
                {result.checksCompleted < result.checksTotal ? ' — this score reflects only what could be verified.' : '.'}
              </p>
            </div>
          </div>
          <p className="checkup-score-scope-note">
            This score covers measurable rendered-page checks only — it is not a verdict on taste, branding
            quality, business quality, or the developer who built the site.
          </p>

          {ecommerceFinding && (
            <div className="checkup-scope-callout" role="note">
              {ecommerceFinding.detail}
            </div>
          )}

          {VISUAL_CATEGORY_ORDER.map((bucket) =>
            grouped[bucket].length > 0 ? (
              <div className="checkup-category" key={bucket}>
                <h3 className="checkup-category-title">{VISUAL_CATEGORY_INFO[bucket].title}</h3>
                <p className="checkup-category-desc">{VISUAL_CATEGORY_INFO[bucket].description}</p>
                <ul className="checkup-finding-list">
                  {grouped[bucket].map((finding) => (
                    <VisualFindingRow finding={finding} key={finding.id} />
                  ))}
                </ul>
              </div>
            ) : null
          )}

          <div className="checkup-about">
            <h3 className="checkup-category-title">What the visual review checks</h3>
            <ul className="checkup-about-list">
              {WHAT_WE_CHECK_VISUAL.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

function ResultsReport({
  result,
  headingRef,
  visualStatus,
  visualResult,
  visualErrorMessage,
}: {
  result: CheckSuccess
  headingRef: RefObject<HTMLHeadingElement>
  visualStatus: VisualStatus
  visualResult: VisualCheckSuccess | null
  visualErrorMessage: string | null
}) {
  const grouped: Record<FindingBucket, Finding[]> = { good: [], improve: [], unverified: [], specialist: [] }
  for (const finding of result.findings) grouped[finding.bucket].push(finding)
  const ecommerceFinding = result.findings.find((f) => f.id === 'ecommerce')

  return (
    <div className="checkup-results">
      <h2 ref={headingRef} tabIndex={-1} className="section-title checkup-results-title">
        Your results
      </h2>

      <p className="checkup-score-eyebrow">Technical Basics Score</p>
      <div className="checkup-score-row">
        <div className="checkup-score">
          <span className="checkup-score-number">{result.score}</span>
          <span className="checkup-score-max">/100</span>
        </div>
        <div>
          <p className="checkup-score-label">{scoreLabel(result.score)}</p>
          <p className="checkup-summary">{result.summary}</p>
          <p className="checkup-checks-count">
            {result.checksCompleted} of {result.checksTotal} checks completed
            {result.checksCompleted < result.checksTotal ? ' — this score reflects only what could be verified.' : '.'}
          </p>
        </div>
      </div>
      <p className="checkup-score-scope-note">
        This score reflects only the automated technical checks completed below. It does not evaluate the
        website’s complete visual design, mobile experience, wording, forms, or every page.
      </p>

      {ecommerceFinding && (
        <div className="checkup-scope-callout" role="note">
          {ecommerceFinding.detail}
        </div>
      )}

      {CATEGORY_ORDER.map((bucket) =>
        grouped[bucket].length > 0 ? (
          <div className="checkup-category" key={bucket}>
            <h3 className="checkup-category-title">{CATEGORY_INFO[bucket].title}</h3>
            <p className="checkup-category-desc">{CATEGORY_INFO[bucket].description}</p>
            <ul className="checkup-finding-list">
              {grouped[bucket].map((finding) => (
                <FindingRow finding={finding} key={finding.id} />
              ))}
            </ul>
          </div>
        ) : null
      )}

      <div className="checkup-about">
        <h3 className="checkup-category-title">What we checked</h3>
        <ul className="checkup-about-list">
          {WHAT_WE_CHECK.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="checkup-disclaimer">
          This automated checkup reviews a limited set of common website basics. It is not a complete security,
          accessibility, SEO, legal, or performance audit. Some findings may require manual review.
        </p>
      </div>

      <VisualSection status={visualStatus} result={visualResult} errorMessage={visualErrorMessage} />

      <div className="checkup-friendly-caution">
        <p className="checkup-friendly-caution-lead">Before anybody fires their web developer…</p>
        <p>
          This automated checkup is a limited snapshot, not a final verdict on your website or the person who built
          it. A lower-than-expected score doesn’t necessarily mean your website is bad or your developer did poor
          work. Automated visual heuristics in particular can miss context that a human would immediately
          understand. Use these findings as conversation starters, and have important concerns manually reviewed
          before anyone changes, replaces, or blames anything.
        </p>
      </div>

      <div className="checkup-cta">
        <h3 className="checkup-cta-title">Want help improving your website?</h3>
        <p className="checkup-cta-body">
          I work with straightforward small-business and service-provider websites. Request a review of these
          results and I’ll let you know whether your project is a good fit for my current services. This isn’t a
          guarantee that I can take on or fix everything found here.
        </p>
        <a href={buildMailtoHref(result, visualResult)} className="btn btn-primary">
          Email My Results to Leslie
        </a>
        <p className="checkup-cta-note">
          This opens a prefilled email for you to review and send. Nothing is submitted automatically.
        </p>
      </div>
    </div>
  )
}

export default function CheckPage() {
  const [inputValue, setInputValue] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [result, setResult] = useState<CheckSuccess | null>(null)

  const [visualStatus, setVisualStatus] = useState<VisualStatus>('idle')
  const [visualResult, setVisualResult] = useState<VisualCheckSuccess | null>(null)
  const [visualErrorMessage, setVisualErrorMessage] = useState<string | null>(null)

  const validationErrorRef = useRef<HTMLParagraphElement>(null)
  const apiErrorRef = useRef<HTMLDivElement>(null)
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (validationError) validationErrorRef.current?.focus()
  }, [validationError])

  useEffect(() => {
    if (status === 'error') apiErrorRef.current?.focus()
    if (status === 'success') resultsHeadingRef.current?.focus()
  }, [status])

  async function runVisualCheck(url: string) {
    setVisualStatus('loading')
    setVisualResult(null)
    setVisualErrorMessage(null)
    try {
      const res = await fetch('/api/check-visual', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      // Check the HTTP status before assuming the body is our normal JSON shape —
      // a 429 from the Vercel Firewall rate limit isn't shaped like our API responses.
      if (res.status === 429) {
        setVisualErrorMessage('You’re running checks faster than we can keep up with. Please wait a minute and try again.')
        setVisualStatus('error')
        return
      }

      const data: VisualCheckResponse = await res.json()
      if (!data.ok) {
        setVisualStatus('error')
        return
      }
      setVisualResult(data)
      setVisualStatus('success')
    } catch {
      setVisualStatus('error')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    const normalized = normalizeWebsiteUrl(inputValue)
    if (!normalized) {
      setValidationError('Please enter a valid website address, like yourbusiness.com.')
      setStatus('idle')
      return
    }

    setValidationError(null)
    setApiError(null)
    setResult(null)
    setStatus('loading')
    setVisualStatus('idle')
    setVisualResult(null)
    setVisualErrorMessage(null)

    try {
      const res = await fetch('/api/check-website', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: normalized.toString() }),
      })
      const data: CheckResponse = await res.json()
      if (!data.ok) {
        setApiError(data.error)
        setStatus('error')
        return
      }
      setResult(data)
      setStatus('success')
      // The visual review runs after the technical check completes, and independently
      // of it — a slow or failed visual review never blocks or hides technical results.
      void runVisualCheck(data.finalUrl)
    } catch {
      setApiError('Something went wrong on our end. Please check your connection and try again.')
      setStatus('error')
    }
  }

  return (
    <>
      <div className="site-bg" aria-hidden="true">
        <img src={beachBg} alt="" className="site-bg-img" />
        <div className="site-bg-overlay" />
      </div>
      <Nav variant="page" />
      <main>
        <section className="checkup">
          <div className="checkup-inner">
            <a href="/" className="checkup-back">
              ← Back to Websites by Leslie
            </a>

            <p className="section-label">Free Tool</p>
            <h1 className="section-title">Free Website Checkup</h1>
            <p className="section-subtitle">
              See a quick, friendly snapshot of common website problems that could be affecting your visitors and
              customers — no signup required.
            </p>

            <form className="checkup-form" onSubmit={handleSubmit} noValidate>
              <label htmlFor="website-url" className="checkup-label">
                Website address
              </label>
              <div className="checkup-field-row">
                <input
                  id="website-url"
                  name="url"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  spellCheck={false}
                  placeholder="yourbusiness.com"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value)
                    if (validationError) setValidationError(null)
                  }}
                  className="checkup-input"
                  aria-invalid={validationError ? 'true' : 'false'}
                  aria-describedby={`checkup-hint${validationError ? ' checkup-validation-error' : ''}`}
                  disabled={status === 'loading'}
                />
                <button type="submit" className="btn btn-primary checkup-submit" disabled={status === 'loading'}>
                  {status === 'loading' ? 'Checking…' : 'Check My Website'}
                </button>
              </div>
              <p id="checkup-hint" className="checkup-hint">
                This usually takes about 10–15 seconds.
              </p>
              {validationError && (
                <p
                  id="checkup-validation-error"
                  className="checkup-inline-error"
                  role="alert"
                  ref={validationErrorRef}
                  tabIndex={-1}
                >
                  {validationError}
                </p>
              )}
            </form>

            <p className="checkup-scope-note">{SCOPE_NOTICE}</p>

            <div aria-live="polite" className="checkup-live-region">
              {status === 'loading' && (
                <div className="checkup-loading" role="status">
                  <span className="checkup-spinner" aria-hidden="true" />
                  Checking your website — this usually takes about 10–15 seconds…
                </div>
              )}
              {status === 'error' && apiError && (
                <div className="checkup-api-error" role="alert" ref={apiErrorRef} tabIndex={-1}>
                  <strong>We couldn’t complete that check.</strong>
                  <p>{apiError}</p>
                  <button type="button" className="btn btn-outline" onClick={() => setStatus('idle')}>
                    Try again
                  </button>
                </div>
              )}
            </div>

            {status === 'success' && result && (
              <ResultsReport
                result={result}
                headingRef={resultsHeadingRef}
                visualStatus={visualStatus}
                visualResult={visualResult}
                visualErrorMessage={visualErrorMessage}
              />
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
