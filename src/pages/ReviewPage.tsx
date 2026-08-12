import { useRef, useState, type FormEvent } from 'react'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import beachBg from '../assets/backgrounds/beach-background.jpeg'

const LESLIE_EMAIL = 'websitesbyleslie01@gmail.com'

// Deliberately light: this only needs to catch obviously-malformed input
// (no @, no dot) well enough that Leslie can actually reply — it's never
// used to fetch or connect to anything, just relayed as plain text in an
// email body, so it doesn't need the stricter shape-validation a
// server-side network request would.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface FormValues {
  name: string
  businessName: string
  websiteAddress: string
  email: string
  message: string
}

interface FieldErrors {
  name?: string
  websiteAddress?: string
  email?: string
}

function buildMailtoHref(values: FormValues): string {
  const lines: string[] = []
  lines.push(`Name: ${values.name.trim()}`)
  if (values.businessName.trim()) lines.push(`Business name: ${values.businessName.trim()}`)
  lines.push(`Website address: ${values.websiteAddress.trim()}`)
  lines.push(`Reply email: ${values.email.trim()}`)
  lines.push('')
  lines.push("What they'd like help with:")
  lines.push(values.message.trim() || 'Not specified')

  const subject = `Free Website Review Request — ${values.businessName.trim() || values.websiteAddress.trim()}`
  const body = lines.join('\n')
  return `mailto:${LESLIE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function buildFallbackText(values: FormValues): string {
  const lines: string[] = []
  lines.push(`To: ${LESLIE_EMAIL}`)
  lines.push(`Name: ${values.name.trim()}`)
  if (values.businessName.trim()) lines.push(`Business name: ${values.businessName.trim()}`)
  lines.push(`Website address: ${values.websiteAddress.trim()}`)
  lines.push(`Reply email: ${values.email.trim()}`)
  lines.push('')
  lines.push("What they'd like help with:")
  lines.push(values.message.trim() || 'Not specified')
  return lines.join('\n')
}

export default function ReviewPage() {
  const [values, setValues] = useState<FormValues>({
    name: '',
    businessName: '',
    websiteAddress: '',
    email: '',
    message: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [copied, setCopied] = useState(false)
  const errorSummaryRef = useRef<HTMLDivElement>(null)
  const confirmationRef = useRef<HTMLDivElement>(null)

  function updateField<K extends keyof FormValues>(field: K, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
    if (errors[field as keyof FieldErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    if (!values.name.trim()) next.name = 'Please enter your name.'
    if (!values.websiteAddress.trim()) next.websiteAddress = 'Please enter your website address.'
    if (!values.email.trim()) {
      next.email = 'Please enter your email address.'
    } else if (!EMAIL_PATTERN.test(values.email.trim())) {
      next.email = "That doesn't look like a valid email address."
    }
    return next
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const nextErrors = validate()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setSubmitted(false)
      requestAnimationFrame(() => errorSummaryRef.current?.focus())
      return
    }
    setErrors({})
    window.location.href = buildMailtoHref(values)
    setSubmitted(true)
    requestAnimationFrame(() => confirmationRef.current?.focus())
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildFallbackText(values))
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      // Clipboard access can fail or be unavailable (older browsers,
      // permissions) — the text is already visibly selectable on the
      // page as a fallback, so this is non-fatal.
    }
  }

  const hasErrors = Object.keys(errors).length > 0

  return (
    <>
      <div className="site-bg" aria-hidden="true">
        <img src={beachBg} alt="" className="site-bg-img" />
        <div className="site-bg-overlay" />
      </div>
      <Nav variant="page" />
      <main>
        <section className="review">
          <div className="review-inner">
            <a href="/" className="review-back">
              ← Back to Websites by Leslie
            </a>

            <p className="section-label">Free Review</p>
            <h1 className="section-title">Free Website Review</h1>
            <p className="section-subtitle">
              Send me your website and I'll take a real, personal look at the basics — how it comes across to
              visitors, mobile friendliness, clarity, contact information, and any obvious opportunities to improve.
            </p>
            <p className="section-subtitle">
              I'll let you know whether your website may be a good fit for my services. No pressure, and no
              automatic score or promise that every issue can be fixed.
            </p>

            {!submitted && (
              <form className="review-form" onSubmit={handleSubmit} noValidate>
                {hasErrors && (
                  <div className="review-error-summary" role="alert" ref={errorSummaryRef} tabIndex={-1}>
                    Please fix the highlighted field{Object.keys(errors).length === 1 ? '' : 's'} below.
                  </div>
                )}

                <label htmlFor="review-name" className="review-label">
                  Name
                </label>
                <input
                  id="review-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={values.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="review-input"
                  aria-invalid={errors.name ? 'true' : 'false'}
                  aria-describedby={errors.name ? 'review-name-error' : undefined}
                />
                {errors.name && (
                  <p id="review-name-error" className="review-inline-error" role="alert">
                    {errors.name}
                  </p>
                )}

                <label htmlFor="review-business" className="review-label">
                  Business name <span className="review-optional">(optional)</span>
                </label>
                <input
                  id="review-business"
                  name="businessName"
                  type="text"
                  autoComplete="organization"
                  value={values.businessName}
                  onChange={(e) => updateField('businessName', e.target.value)}
                  className="review-input"
                />

                <label htmlFor="review-url" className="review-label">
                  Website address
                </label>
                <input
                  id="review-url"
                  name="websiteAddress"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  spellCheck={false}
                  placeholder="yourbusiness.com"
                  value={values.websiteAddress}
                  onChange={(e) => updateField('websiteAddress', e.target.value)}
                  className="review-input"
                  aria-invalid={errors.websiteAddress ? 'true' : 'false'}
                  aria-describedby={errors.websiteAddress ? 'review-url-error' : undefined}
                />
                {errors.websiteAddress && (
                  <p id="review-url-error" className="review-inline-error" role="alert">
                    {errors.websiteAddress}
                  </p>
                )}

                <label htmlFor="review-email" className="review-label">
                  Email address
                </label>
                <input
                  id="review-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={values.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className="review-input"
                  aria-invalid={errors.email ? 'true' : 'false'}
                  aria-describedby={errors.email ? 'review-email-error' : undefined}
                />
                {errors.email && (
                  <p id="review-email-error" className="review-inline-error" role="alert">
                    {errors.email}
                  </p>
                )}

                <label htmlFor="review-message" className="review-label">
                  What would you like help with? <span className="review-optional">(optional)</span>
                </label>
                <textarea
                  id="review-message"
                  name="message"
                  rows={4}
                  value={values.message}
                  onChange={(e) => updateField('message', e.target.value)}
                  className="review-textarea"
                />

                <button type="submit" className="btn btn-primary review-submit">
                  Open My Email to Request a Free Review
                </button>
              </form>
            )}

            {submitted && (
              <div className="review-confirmation" role="status" ref={confirmationRef} tabIndex={-1}>
                <p className="review-confirmation-lead">
                  Your email app should now be open with your request filled in. Please review it and click Send.
                </p>
                <p>
                  If nothing opened — for example, if this device doesn't have an email app set up — you can send
                  your request directly instead:
                </p>
                <p className="review-fallback-email">
                  <a href={`mailto:${LESLIE_EMAIL}`}>{LESLIE_EMAIL}</a>
                </p>
                <div className="review-fallback-block">
                  <div className="review-fallback-header">
                    <span>Your request</span>
                    <button type="button" className="btn btn-outline review-copy-btn" onClick={handleCopy}>
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre className="review-fallback-text">{buildFallbackText(values)}</pre>
                </div>
                <button
                  type="button"
                  className="btn btn-outline review-start-over"
                  onClick={() => {
                    setValues({ name: '', businessName: '', websiteAddress: '', email: '', message: '' })
                    setErrors({})
                    setCopied(false)
                    setSubmitted(false)
                  }}
                >
                  Start over
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
