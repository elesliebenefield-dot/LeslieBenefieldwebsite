// Scrolls a page through its full height (to trigger loading="lazy" content) and
// waits until the scroll position has genuinely settled back at the top before
// resolving — not just after a fixed delay.
//
// This matters because some pages set `scroll-behavior: smooth` globally, which
// makes every `window.scrollTo()` call (including this function's own scrolling)
// animate instead of jumping instantly. A fixed delay after the final
// `scrollTo(0, 0)` can easily resolve while that animation is still in progress,
// which makes whatever the measurement code reads afterward reflect a transient,
// mid-scroll layout rather than the page's actual resting state — content that
// naturally passes behind a sticky header while scrolling gets misread as
// permanently obstructed. Temporarily forcing scroll-behavior to 'auto' during
// this function's own scrolling avoids that entirely for the steps it controls;
// polling for a stable scrollY afterward provides a second line of defense (a
// page's own scroll-linked JS, for example, isn't covered by the style override).

import type { Page } from 'puppeteer-core'

export interface ScrollSettleOptions {
  /** How often to re-check scroll position while waiting for it to settle. */
  pollIntervalMs?: number
  /** Give up waiting after this long and proceed anyway, rather than risk
   *  hanging the whole check on a page whose scroll position never settles
   *  (e.g. one with its own continuous auto-scroll behavior). */
  maxWaitMs?: number
  /** Consecutive stable readings required before considering it settled. */
  stableReadsRequired?: number
}

const SETTLE_TOLERANCE_PX = 1

export async function scrollThroughPageAndSettle(page: Page, opts: ScrollSettleOptions = {}): Promise<void> {
  const { pollIntervalMs = 40, maxWaitMs = 2500, stableReadsRequired = 3 } = opts

  const previous = await page.evaluate(() => {
    const root = document.documentElement
    const body = document.body
    const prev = { root: root.style.scrollBehavior, body: body.style.scrollBehavior }
    root.style.scrollBehavior = 'auto'
    body.style.scrollBehavior = 'auto'
    return prev
  })

  try {
    await page.evaluate(async () => {
      const step = Math.max(300, window.innerHeight * 0.8)
      const maxSteps = 12
      let y = 0
      for (let i = 0; i < maxSteps; i++) {
        y += step
        window.scrollTo(0, y)
        // Each stop needs real time for the browser to notice the intersection
        // and actually kick off + finish the lazy-load fetch — a short poll here
        // is far more reliable than a single fixed delay per step.
        await new Promise((r) => setTimeout(r, 250))
        if (y >= document.documentElement.scrollHeight) break
      }
      window.scrollTo(0, 0)
    })

    const start = Date.now()
    let consecutiveSettled = 0
    while (Date.now() - start < maxWaitMs) {
      const y = await page.evaluate(() => window.scrollY)
      if (y <= SETTLE_TOLERANCE_PX) {
        consecutiveSettled++
        if (consecutiveSettled >= stableReadsRequired) return
      } else {
        consecutiveSettled = 0
      }
      await new Promise((r) => setTimeout(r, pollIntervalMs))
    }
    // Timed out without confirming settle. Non-fatal — proceed with whatever
    // state the page is in rather than fail the whole check over this.
  } finally {
    await page.evaluate((prev) => {
      document.documentElement.style.scrollBehavior = prev.root
      document.body.style.scrollBehavior = prev.body
    }, previous)
  }
}
