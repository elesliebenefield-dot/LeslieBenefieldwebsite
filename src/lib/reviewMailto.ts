// Pure, browser-free URL/text builders for the Free Website Review request
// form (src/pages/ReviewPage.tsx). Kept separate from the component
// specifically so the generated recipient/subject/body can be tested
// directly, with no browser involved — a real mailto: link, even clicked
// inside a "headless" Chrome instance, still gets dispatched to the OS's
// registered mail handler (macOS LaunchServices), independent of the
// browser's own sandboxing. That makes headless-Chrome clicks unsafe for
// this specific feature in a way they aren't for anything else on this
// site, so content correctness is verified here instead, without ever
// triggering a real mailto: navigation.

export const LESLIE_EMAIL = 'websitesbyleslie01@gmail.com'

export const CONTACT_METHODS = ['Phone call', 'Text message', 'Email'] as const
export type ContactMethod = (typeof CONTACT_METHODS)[number]

export interface ReviewFormValues {
  name: string
  businessName: string
  websiteAddress: string
  phone: string
  contactMethod: ContactMethod | ''
  message: string
}

function bodyLines(values: ReviewFormValues): string[] {
  const lines: string[] = []
  lines.push(`Name: ${values.name.trim()}`)
  if (values.businessName.trim()) lines.push(`Business name: ${values.businessName.trim()}`)
  lines.push(`Website address: ${values.websiteAddress.trim()}`)
  lines.push(`Phone number: ${values.phone.trim()}`)
  lines.push(`Preferred first contact method: ${values.contactMethod || 'Not specified'}`)
  lines.push('')
  lines.push("What they'd like help with:")
  lines.push(values.message.trim() || 'Not specified')
  return lines
}

export function buildMailtoSubject(values: ReviewFormValues): string {
  return `Free Website Review Request — ${values.businessName.trim() || values.websiteAddress.trim()}`
}

export function buildMailtoBody(values: ReviewFormValues): string {
  return bodyLines(values).join('\n')
}

export function buildMailtoHref(values: ReviewFormValues): string {
  const subject = buildMailtoSubject(values)
  const body = buildMailtoBody(values)
  return `mailto:${LESLIE_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function buildFallbackText(values: ReviewFormValues): string {
  return [`To: ${LESLIE_EMAIL}`, ...bodyLines(values)].join('\n')
}

declare global {
  interface Window {
    /** Automated-testing seam only. When present, ReviewPage calls this
     *  instead of actually navigating to the mailto: href — real visitors
     *  never define this, so real behavior (window.location.href = href,
     *  which opens their configured email app) is unconditionally
     *  preserved. Exists because a real mailto: navigation, even inside
     *  headless Chrome, still gets dispatched to the OS's registered mail
     *  handler (confirmed: it opened a real compose window on the
     *  developer's own machine during preview verification) — there is no
     *  way to click-test the real submit action without that side effect
     *  on this platform, so tests intercept here instead. */
    __reviewPageTestOpenMailClient?: (href: string) => void
  }
}

/** The only place ReviewPage.tsx triggers the actual "open mail client"
 *  side effect — see the Window.__reviewPageTestOpenMailClient doc comment
 *  above for why this indirection exists. */
export function openMailClient(href: string): void {
  if (typeof window.__reviewPageTestOpenMailClient === 'function') {
    window.__reviewPageTestOpenMailClient(href)
    return
  }
  window.location.href = href
}

/** Parses a mailto: href back into its recipient/subject/body parts, for
 *  tests that only have the string (e.g. read from a DOM href attribute)
 *  and want to assert on the decoded content without re-deriving it. */
export function parseMailtoHref(href: string): { recipient: string; subject: string; body: string } {
  const withoutScheme = href.replace(/^mailto:/, '')
  const [recipient, query = ''] = withoutScheme.split('?')
  const params = new URLSearchParams(query)
  return {
    recipient,
    subject: params.get('subject') ?? '',
    body: params.get('body') ?? '',
  }
}
