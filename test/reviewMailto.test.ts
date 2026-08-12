// Pure, browser-free tests for the Free Website Review request's mailto:
// content (src/lib/reviewMailto.ts). Deliberately no browser and no click
// on any mailto: link — a real mailto: navigation, even inside headless
// Chrome, still gets dispatched to the OS's registered mail handler
// (confirmed: it opened a real compose window on the developer's machine
// during earlier preview verification, independent of the browser's own
// sandboxing). Recipient/subject/body correctness is verified here as
// plain string assertions instead.
//
// Run with: node --test test/reviewMailto.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildMailtoHref, buildFallbackText, parseMailtoHref, LESLIE_EMAIL, EMAIL_PATTERN, type ReviewFormValues } from '../src/lib/reviewMailto.ts'

function values(overrides: Partial<ReviewFormValues> = {}): ReviewFormValues {
  return {
    name: 'Jamie Rivera',
    businessName: "Jamie's Bakery",
    websiteAddress: 'jamiesbakery.com',
    email: 'jamie@jamiesbakery.com',
    message: 'Not sure my site looks good on phones.',
    ...overrides,
  }
}

test('mailto href targets the correct recipient', () => {
  const { recipient } = parseMailtoHref(buildMailtoHref(values()))
  assert.equal(recipient, LESLIE_EMAIL)
  assert.equal(LESLIE_EMAIL, 'websitesbyleslie01@gmail.com')
})

test('subject uses the business name when supplied', () => {
  const { subject } = parseMailtoHref(buildMailtoHref(values()))
  assert.equal(subject, "Free Website Review Request — Jamie's Bakery")
})

test('subject falls back to the website address when no business name is given', () => {
  const { subject } = parseMailtoHref(buildMailtoHref(values({ businessName: '' })))
  assert.equal(subject, 'Free Website Review Request — jamiesbakery.com')
})

test('body includes name, website address, reply email, and the message, each on its own labeled line', () => {
  const { body } = parseMailtoHref(buildMailtoHref(values()))
  assert.equal(
    body,
    [
      'Name: Jamie Rivera',
      "Business name: Jamie's Bakery",
      'Website address: jamiesbakery.com',
      'Reply email: jamie@jamiesbakery.com',
      '',
      "What they'd like help with:",
      'Not sure my site looks good on phones.',
    ].join('\n')
  )
})

test('body omits the business-name line entirely when none was supplied, rather than printing it empty', () => {
  const { body } = parseMailtoHref(buildMailtoHref(values({ businessName: '' })))
  assert.ok(!body.includes('Business name:'))
})

test('body says "Not specified" when no message was supplied, rather than leaving a blank line', () => {
  const { body } = parseMailtoHref(buildMailtoHref(values({ message: '' })))
  assert.match(body, /What they'd like help with:\nNot specified$/)
})

test('leading/trailing whitespace in every field is trimmed before it reaches the subject or body', () => {
  const { subject, body } = parseMailtoHref(
    buildMailtoHref(
      values({
        name: '  Jamie Rivera  ',
        businessName: "  Jamie's Bakery  ",
        websiteAddress: '  jamiesbakery.com  ',
        email: '  jamie@jamiesbakery.com  ',
        message: '  Not sure my site looks good on phones.  ',
      })
    )
  )
  assert.equal(subject, "Free Website Review Request — Jamie's Bakery")
  assert.match(body, /^Name: Jamie Rivera$/m)
  assert.match(body, /^Reply email: jamie@jamiesbakery\.com$/m)
  assert.match(body, /^Not sure my site looks good on phones\.$/m)
})

test('special characters (accents, ampersands, quotes) survive round-trip through URL encoding intact', () => {
  const v = values({
    name: 'Tomás García',
    businessName: "García's Auto & Repair",
    message: 'Question: does "mobile-friendly" mean responsive design?',
  })
  const { subject, body } = parseMailtoHref(buildMailtoHref(v))
  assert.equal(subject, "Free Website Review Request — García's Auto & Repair")
  assert.match(body, /^Name: Tomás García$/m)
  assert.match(body, /^Business name: García's Auto & Repair$/m)
  assert.match(body, /Question: does "mobile-friendly" mean responsive design\?$/m)
})

test('the mailto href itself is well-formed: scheme, recipient, and both query params present', () => {
  const href = buildMailtoHref(values())
  assert.ok(href.startsWith(`mailto:${LESLIE_EMAIL}?`))
  assert.match(href, /[?&]subject=/)
  assert.match(href, /[?&]body=/)
})

test('the visible copyable fallback text carries the same fields as the mailto body, plus an explicit "To:" line', () => {
  const v = values()
  const fallback = buildFallbackText(v)
  assert.match(fallback, new RegExp(`^To: ${LESLIE_EMAIL}$`, 'm'))
  assert.match(fallback, /^Name: Jamie Rivera$/m)
  assert.match(fallback, /^Business name: Jamie's Bakery$/m)
  assert.match(fallback, /^Website address: jamiesbakery\.com$/m)
  assert.match(fallback, /^Reply email: jamie@jamiesbakery\.com$/m)
  assert.match(fallback, /Not sure my site looks good on phones\.$/m)
})

test('EMAIL_PATTERN accepts ordinary addresses and rejects obviously malformed input', () => {
  assert.ok(EMAIL_PATTERN.test('jamie@jamiesbakery.com'))
  assert.ok(EMAIL_PATTERN.test('j.rivera+review@example.co.uk'))
  assert.ok(!EMAIL_PATTERN.test('not-an-email'))
  assert.ok(!EMAIL_PATTERN.test('missing-domain@'))
  assert.ok(!EMAIL_PATTERN.test('@missing-local.com'))
  assert.ok(!EMAIL_PATTERN.test('no-at-sign.com'))
})
