import { useEffect, useRef, useState, type FormEvent } from 'react'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import beachBg from '../assets/backgrounds/beach-background.jpeg'
import { LESLIE_EMAIL, CONTACT_METHODS, buildMailtoHref, buildFallbackText, openMailClient, type ReviewFormValues } from '../lib/reviewMailto'

type FormValues = ReviewFormValues

const BLANK_VALUES: FormValues = {
  name: '',
  businessName: '',
  websiteAddress: '',
  phone: '',
  contactMethod: '',
  message: '',
}

interface FieldErrors {
  name?: string
  websiteAddress?: string
  phone?: string
  contactMethod?: string
}

export default function ReviewPage() {
  const [values, setValues] = useState<FormValues>(BLANK_VALUES)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [copied, setCopied] = useState(false)
  // Increments only on a failed submit attempt — deliberately NOT the same
  // as "errors changed," since errors also changes (shrinks) whenever the
  // visitor fixes one field while others still have errors, which must
  // NOT steal focus back to the summary while they're actively typing.
  const [failedSubmitCount, setFailedSubmitCount] = useState(0)
  const errorSummaryRef = useRef<HTMLDivElement>(null)
  const confirmationRef = useRef<HTMLDivElement>(null)

  // useEffect (not requestAnimationFrame in the submit handler) so this
  // always runs after React has actually committed the DOM node the ref
  // points at — an rAF scheduled inside the same event handler that
  // triggers the state update can race React's commit and fire before the
  // element exists, intermittently leaving focus un-moved.
  useEffect(() => {
    if (failedSubmitCount > 0) errorSummaryRef.current?.focus()
  }, [failedSubmitCount])

  useEffect(() => {
    if (submitted) confirmationRef.current?.focus()
  }, [submitted])

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }))
    if (errors[field as keyof FieldErrors]) {
      setErrors((prev) => {
        // Delete the key entirely — leaving it present but set to
        // `undefined` would keep it in Object.keys(errors), which drives
        // both hasErrors (the summary banner never disappearing) and the
        // focus-management effect (repeatedly stealing focus back to the
        // summary on every subsequent keystroke).
        const next = { ...prev }
        delete next[field as keyof FieldErrors]
        return next
      })
    }
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    if (!values.name.trim()) next.name = 'Please enter your name.'
    if (!values.websiteAddress.trim()) next.websiteAddress = 'Please enter your website address.'
    if (!values.phone.trim()) next.phone = 'Please enter your phone number.'
    if (!values.contactMethod) next.contactMethod = 'Please choose how you would prefer to be contacted.'
    return next
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const nextErrors = validate()
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setSubmitted(false)
      setFailedSubmitCount((n) => n + 1)
      return
    }
    setErrors({})
    openMailClient(buildMailtoHref(values))
    setSubmitted(true)
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

                <label htmlFor="review-phone" className="review-label">
                  Phone number
                </label>
                <input
                  id="review-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={values.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className="review-input"
                  aria-invalid={errors.phone ? 'true' : 'false'}
                  aria-describedby={errors.phone ? 'review-phone-error' : undefined}
                />
                {errors.phone && (
                  <p id="review-phone-error" className="review-inline-error" role="alert">
                    {errors.phone}
                  </p>
                )}

                <fieldset
                  className="review-fieldset"
                  aria-invalid={errors.contactMethod ? 'true' : 'false'}
                  aria-describedby={errors.contactMethod ? 'review-contact-method-error' : undefined}
                >
                  <legend className="review-label review-legend">How would you prefer I contact you first?</legend>
                  <div className="review-radio-group">
                    {CONTACT_METHODS.map((method) => (
                      <label key={method} className="review-radio-option">
                        <input
                          type="radio"
                          name="contactMethod"
                          value={method}
                          checked={values.contactMethod === method}
                          onChange={() => updateField('contactMethod', method)}
                        />
                        {method}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {errors.contactMethod && (
                  <p id="review-contact-method-error" className="review-inline-error" role="alert">
                    {errors.contactMethod}
                  </p>
                )}

                <p className="review-contact-note">
                  I'll use your preferred contact method to follow up. Before we begin planning a website project,
                  we'll schedule a short phone call to talk through the details.
                </p>

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
                  className="btn btn-primary review-start-over"
                  onClick={() => {
                    setValues(BLANK_VALUES)
                    setErrors({})
                    setCopied(false)
                    setSubmitted(false)
                  }}
                >
                  Request another review
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
