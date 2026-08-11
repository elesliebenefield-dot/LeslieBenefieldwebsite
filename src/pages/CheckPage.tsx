import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import beachBg from '../assets/backgrounds/beach-background.jpeg'
import { normalizeWebsiteUrl } from '../lib/websiteCheck'
import type { CheckResponse, CheckSuccess, Finding, FindingBucket } from '../lib/websiteCheck'
import type { RebuildCheckResponse, RebuildCheckSuccess } from '../lib/visualCheck'
import { REBUILD_CHECK_LABEL } from '../lib/visualCheck'
import { buildMailtoHref } from '../lib/emailBody'
import { mergeFallbackIntoResult } from '../lib/technicalFallbackMerge'

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
    description:
      'Improvements Leslie may be able to help with, for straightforward informational and service-business websites. Online stores, marketplace shops, and complex ecommerce sites are often better handled by their platform provider or an ecommerce specialist.',
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

// Email-building logic (buildCombinedEmailBody/buildMailtoHref) lives in
// ../lib/emailBody.ts, extracted so it's directly testable without a
// browser/JSX environment — see test/emailBody.test.ts.

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
  // Response time is measured and shown for context, but — unlike the other cards
  // here — it isn't one of the scored/counted checks in "X of Y checks completed"
  // above, since it isn't a pass/fail signal on its own. Flagging that inline
  // avoids the card count above appearing to disagree with that tally.
  const isSupplementary = finding.id === 'response-time'
  return (
    <li className={`checkup-finding checkup-finding--${finding.bucket}`}>
      <span className="checkup-finding-icon" aria-hidden="true">
        <Icon />
      </span>
      <span>
        <span className="checkup-finding-label">
          {finding.label}
          {isSupplementary && <span className="checkup-finding-note"> (measured for context, not one of the counted checks)</span>}
        </span>
        <span className="checkup-finding-detail">{finding.detail}</span>
      </span>
    </li>
  )
}

// VIEWPORT_LABEL and VisualFindingRow (old scored-review-only rendering,
// keyed on VisualFinding's viewport/measurable fields) were removed
// here — the first real-checker release's VisualSection below renders
// its own plain-English findings list.

type VisualStatus = 'idle' | 'loading' | 'success' | 'error'

function VisualSection({
  status,
  result,
  errorMessage,
}: {
  status: VisualStatus
  result: RebuildCheckSuccess | null
  errorMessage: string | null
}) {
  return (
    <div className="checkup-visual-section">
      <h2 className="section-title checkup-results-title checkup-visual-title">Visual &amp; Usability Review</h2>
      <p className="checkup-visual-intro">
        A real browser opens your homepage at mobile width and checks for a couple of specific, measurable issues.
        This is a separate review from the Technical Basics Score above — the two are not combined into one score.
      </p>

      {(status === 'loading' || status === 'idle') && (
        <div className="checkup-loading" role="status">
          <span className="checkup-spinner" aria-hidden="true" />
          Rendering your website in a browser at mobile width — this can take up to a minute…
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
        <ul className="checkup-finding-list">
          {result.findings.map((finding) => (
            <li className="checkup-finding" key={finding.checkId}>
              <p className="checkup-finding-title">{REBUILD_CHECK_LABEL[finding.checkId]}</p>
              <p className="checkup-score-label">{finding.label}</p>
              <p className="checkup-summary">{finding.detail}</p>
            </li>
          ))}
        </ul>
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
  visualResult: RebuildCheckSuccess | null
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
          work. Automated visual checks can sometimes miss details that a person would immediately understand.
          Use these findings as conversation starters, and have important concerns manually reviewed
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
        {visualStatus === 'loading' ? (
          <button type="button" className="btn btn-primary" disabled aria-disabled="true">
            Preparing your results…
          </button>
        ) : (
          <a
            href={buildMailtoHref(result, visualResult)}
            className="btn btn-primary"
          >
            Email My Results to Leslie
          </a>
        )}
        <p className="checkup-cta-note">
          {visualStatus === 'loading'
            ? 'Waiting for the visual review to finish so the email includes your complete results.'
            : 'This opens a prefilled email for you to review and send. Nothing is submitted automatically.'}
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
  const [visualResult, setVisualResult] = useState<RebuildCheckSuccess | null>(null)
  const [visualErrorMessage, setVisualErrorMessage] = useState<string | null>(null)

  const validationErrorRef = useRef<HTMLParagraphElement>(null)
  const apiErrorRef = useRef<HTMLDivElement>(null)
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null)

  // Identifies "the current submission" so a still-in-flight request from a
  // previous submission can recognize it's been superseded and ignore its own
  // response when it eventually arrives, instead of overwriting whatever the
  // newer submission already displayed. Both the technical and visual checks
  // share one counter since either can race against a later submission — the
  // technical fetch is usually fast, but network conditions aren't guaranteed.
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (validationError) validationErrorRef.current?.focus()
  }, [validationError])

  useEffect(() => {
    if (status === 'error') apiErrorRef.current?.focus()
    if (status === 'success') resultsHeadingRef.current?.focus()
  }, [status])

  async function runVisualCheck(url: string, requestId: number, needsContactFallback: boolean, needsLinksFallback: boolean) {
    setVisualStatus('loading')
    setVisualResult(null)
    setVisualErrorMessage(null)
    try {
      const res = await fetch('/api/check-visual', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, needsContactFallback, needsLinksFallback }),
      })
      if (requestId !== requestIdRef.current) return // superseded by a newer submission

      // Check the HTTP status before assuming the body is our normal JSON shape —
      // a 429 from the Vercel Firewall rate limit isn't shaped like our API responses.
      if (res.status === 429) {
        setVisualErrorMessage('You’re running checks faster than we can keep up with. Please wait a minute and try again.')
        setVisualStatus('error')
        return
      }

      const data: RebuildCheckResponse = await res.json()
      if (requestId !== requestIdRef.current) return // superseded while parsing the response
      if (!data.ok) {
        setVisualStatus('error')
        return
      }
      setVisualResult(data)
      setVisualStatus('success')
      // A resolved contact/links fallback replaces the corresponding
      // "Unable to verify" Technical Basics finding and renormalizes the
      // score — see mergeFallbackIntoResult above. Absent on every
      // request that didn't need one, wasn't requested, or couldn't be
      // resolved (extraction failure, or genuinely too few rendered
      // links) — the technical result is untouched in those cases.
      if (data.contactFallback || data.linksFallback) {
        setResult((prev) => (prev ? mergeFallbackIntoResult(prev, data.contactFallback, data.linksFallback) : prev))
      }
    } catch {
      if (requestId !== requestIdRef.current) return
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

    const requestId = ++requestIdRef.current

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
      if (requestId !== requestIdRef.current) return // superseded by a newer submission

      const data: CheckResponse = await res.json()
      if (requestId !== requestIdRef.current) return // superseded while parsing the response
      if (!data.ok) {
        setApiError(data.error)
        setStatus('error')
        return
      }
      setResult(data)
      setStatus('success')
      // The visual review runs after the technical check completes, and independently
      // of it — a slow or failed visual review never blocks or hides technical results.
      // If contact-info and/or homepage-links came back "unable to verify" specifically
      // because the page appears to need JavaScript rendering, ask the visual review's
      // already-open browser page to also gather that evidence — no second browser launch.
      const contactFinding = data.findings.find((f) => f.id === 'contact')
      const linksFinding = data.findings.find((f) => f.id === 'links')
      const needsContactFallback = contactFinding?.bucket === 'unverified'
      const needsLinksFallback = linksFinding?.bucket === 'unverified'
      void runVisualCheck(data.finalUrl, requestId, needsContactFallback, needsLinksFallback)
    } catch {
      if (requestId !== requestIdRef.current) return
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
