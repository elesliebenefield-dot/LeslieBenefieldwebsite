import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import beachBg from '../assets/backgrounds/beach-background.jpeg'
import { normalizeWebsiteUrl } from '../lib/websiteCheck'
import type { CheckResponse, CheckSuccess, Finding, FindingBucket } from '../lib/websiteCheck'

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

function buildResultsEmailBody(result: CheckSuccess, detailLimit: number | null): string {
  const lines: string[] = []
  lines.push(`Website checked: ${result.finalUrl}`)
  lines.push(`Technical Basics Score: ${result.score}/100`)
  lines.push(`Checks completed: ${result.checksCompleted} of ${result.checksTotal}`)
  lines.push('')

  for (const bucket of CATEGORY_ORDER) {
    const items = result.findings.filter((f) => f.bucket === bucket)
    if (items.length === 0) continue
    lines.push(`${EMAIL_SECTION_TITLE[bucket]}:`)
    for (const finding of items) {
      const detail = detailLimit === null ? finding.detail : truncateDetail(finding.detail, detailLimit)
      lines.push(`- ${finding.label}: ${detail}`)
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

function buildMailtoHref(result: CheckSuccess): string {
  const subject = `Website Checkup Results — ${checkedDomain(result)}`

  const toEncoded = (body: string) =>
    `mailto:${RESULTS_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

  let href = toEncoded(buildResultsEmailBody(result, null))
  if (href.length > MAILTO_SAFE_LENGTH) {
    href = toEncoded(buildResultsEmailBody(result, 70))
  }
  return href
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

function ResultsReport({ result, headingRef }: { result: CheckSuccess; headingRef: RefObject<HTMLHeadingElement> }) {
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
        <div className="checkup-friendly-caution">
          <p className="checkup-friendly-caution-lead">Before anybody fires their web developer…</p>
          <p>
            This automated checkup is a limited snapshot, not a final verdict on your website or the person who
            built it. A lower-than-expected score doesn’t necessarily mean your website is bad or your developer
            did poor work. Use these findings as conversation starters, and have important concerns manually
            reviewed before making changes.
          </p>
        </div>
      </div>

      <div className="checkup-cta">
        <h3 className="checkup-cta-title">Want help improving your website?</h3>
        <p className="checkup-cta-body">
          I work with straightforward small-business and service-provider websites. Request a review of these
          results and I’ll let you know whether your project is a good fit for my current services. This isn’t a
          guarantee that I can take on or fix everything found here.
        </p>
        <a href={buildMailtoHref(result)} className="btn btn-primary">
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

            {status === 'success' && result && <ResultsReport result={result} headingRef={resultsHeadingRef} />}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
