// Constructs a mailto: URI with optional pre-filled recipient, subject, and body.
// Pass `to = ''` for the public demo so the visitor chooses the recipient.
// The `to` parameter is kept configurable so a customized client version
// can prefill a realtor email address without changing the calling code.
export function buildMailtoHref(to: string, subject: string, body: string): string {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
