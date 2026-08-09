// Pure scoring logic: turns raw browser measurements (see visualAnalysis.ts) into
// the Visual & Usability report. Deliberately has no browser/network dependency so
// it can be tested directly against synthetic measurement objects.

import type { RawMeasurements, RawTextIssue, TinyFontRole } from './visualAnalysis.js'
import { VISUAL_CHECK_WEIGHTS, VISUAL_CHECK_COUNT, type VisualFinding, type VisualCheckId, type FindingViewport } from './visualCheck.js'

interface ScoredFinding extends VisualFinding {
  points: number
}

export interface VisualReport {
  score: number
  findings: VisualFinding[]
  checksCompleted: number
  checksTotal: number
}

function combineViewport(onDesktop: boolean, onMobile: boolean): FindingViewport {
  if (onDesktop && onMobile) return 'both'
  return onDesktop ? 'desktop' : 'mobile'
}

/** Which viewport(s) actually produced real measurement data — as opposed to
 *  combineViewport, which describes which viewport(s) exhibited a PROBLEM.
 *  Used so a "good" (clean) result can honestly say which viewport(s) were
 *  actually verified, instead of always claiming 'both' even when only one
 *  viewport's browser session succeeded. Only meaningful when at least one
 *  side is truthy — every call site already guards the both-null case
 *  separately (routing to `unverified` instead). */
function availableViewport(desktop: unknown, mobile: unknown): FindingViewport {
  return combineViewport(!!desktop, !!mobile)
}

/** Appends an honest caveat to a "good"/clean finding's detail when only one
 *  viewport's data actually backed the result, so a clean result never
 *  silently implies more coverage than it actually had (e.g. a page whose
 *  mobile session failed to load would otherwise read as "verified clean on
 *  both," when mobile was never actually checked at all). */
function partialCoverageNote(desktop: unknown, mobile: unknown): string {
  if (desktop && mobile) return ''
  const missing = !desktop ? 'Desktop' : 'Mobile'
  const present = !desktop ? 'mobile' : 'desktop'
  return ` (${missing} could not be measured for this page, so this reflects ${present} only.)`
}

/** True when a page had more real candidates in this category than the
 *  measurement layer's bounded scan examined (see IncompleteCoverage in
 *  visualAnalysis.ts). A category in this state must never be scored off a
 *  partial sample — a genuine issue sitting just past the cap would be
 *  invisible (falsely "good"), and a clean-looking partial sample would
 *  falsely earn full credit the page may not actually deserve. Every
 *  category that tracks incompleteCoverage routes to `unverified` instead
 *  whenever this is true, regardless of what the partial scan found. */
function isIncomplete(...incomplete: Array<boolean | undefined>): boolean {
  return incomplete.some(Boolean)
}

/** Standard "safe measurement limit exceeded" framing for a category routed
 *  to unverified because of incomplete coverage. `seenSummary` preserves
 *  what the partial scan actually found as context — never as a score. */
function incompleteCoverageDetail(seenSummary: string): string {
  return `This page has more elements to check than the checker can safely scan in a single pass, so this couldn't be automatically verified for scoring. ${seenSummary}`
}

// ─── Overflow-only 3-way viewport helpers ──────────────────────────────────
// Overflow is currently the only check that also measures an intermediate/
// tablet-width viewport (see api/check-visual.ts) — a real bug was found
// that only reproduced at tablet widths, with desktop and mobile both clean.
// These two helpers are deliberately scoped to just the overflow check below,
// not merged into combineViewport/availableViewport above, which every other
// check still uses in their original 2-way form.
//
// Overflow also separately folds a narrow (320px) measurement into the
// "mobile" flag below (see buildVisualReport's mobileOver/mobilePresent)
// rather than adding a 4th category here — a 320px-only overflow is still,
// in every customer-facing sense, a mobile-width problem.

/** Natural-language join: ['desktop'] -> "desktop"; ['desktop','tablet'] ->
 *  "desktop and tablet"; ['desktop','tablet','mobile'] -> "desktop, tablet,
 *  and mobile". */
function formatViewportList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

/** Collapses which of desktop/tablet/mobile a boolean applies to into a
 *  single FindingViewport: the one specific viewport if exactly one is true,
 *  otherwise 'both' (this check's existing catch-all for "more than one" —
 *  the finding's own detail text always names every affected viewport, so
 *  the badge doesn't need to enumerate every 2-of-3 combination). */
function overflowViewportLabel(desktopFlag: boolean, tabletFlag: boolean, mobileFlag: boolean): FindingViewport {
  const flags: Array<[boolean, FindingViewport]> = [
    [desktopFlag, 'desktop'],
    [tabletFlag, 'tablet'],
    [mobileFlag, 'mobile'],
  ]
  const present = flags.filter(([f]) => f).map(([, name]) => name)
  return present.length === 1 ? present[0] : 'both'
}

// ─── Tiny-font scoring model ───────────────────────────────────────────────
// A raw instance count treats a 10.5px category tag the same as a 6px
// paragraph, and treats one CSS rule applied to nine elements as nine
// unrelated defects. This model instead weighs: how far below the threshold
// the text actually is, what role it plays on the page (established type
// scales — Material Design's "caption"/"overline", Apple HIG's "footnote" —
// already treat small secondary text as a legitimate, named category rather
// than a defect), how many *unique styles* are affected rather than raw DOM
// element count, and a hard floor so a genuinely severe, widely-repeated
// problem in body or navigation text can never be diluted away by weighting.
//
// Every constant here is a deliberate, named starting point — not a derived
// constant — and is exercised directly by dedicated unit tests so a future
// change to any one of them is visible in a test diff, not just a score.

/** The existing detection threshold: text below this size (mobile only) is a
 *  tiny-font candidate at all. Unchanged from the original design. */
export const TINY_FONT_THRESHOLD_PX = 12
/** Font size at or below which a tiny-font instance is treated as maximally
 *  severe (severity 1.0). Commonly-cited practical floor for legible mobile
 *  text; text below this is not a borderline case under any role. */
export const TINY_FONT_SEVERITY_FLOOR_PX = 7

/** How much a role should be trusted to matter for genuine readability.
 *  Body copy is the essential-reading case (1.0). Labels/eyebrows/badges/
 *  captions are supplementary, conventionally-smaller text in most design
 *  systems (0.4). Footer legal/credit text is conventionally de-emphasized
 *  (0.5). 'unknown' is deliberately mid-weight rather than low, so an
 *  unclassifiable element is never quietly under-penalized. */
export const TINY_FONT_ROLE_WEIGHTS: Record<TinyFontRole, number> = {
  body: 1.0,
  nav: 0.9,
  footer: 0.5,
  label: 0.4,
  unknown: 0.7,
}

/** A style used many times is more visible across the page than the same
 *  style used once, but not linearly worse — fixing one CSS rule fixes every
 *  instance at once. This caps how much repetition alone can add. */
export const TINY_FONT_VOLUME_CAP = 1.5
export const TINY_FONT_VOLUME_STEP = 0.1

/** Severe-override thresholds: a style is treated as an automatic full
 *  deduction — bypassing the weighted formula entirely — only when it is
 *  genuinely small (severity at/above this), plays an essential-reading role
 *  (role weight at/above this — body or nav), AND appears often enough to be
 *  a systemic problem rather than a one-off. All three must hold; this is a
 *  safety floor for clearly severe cases, not a general-purpose trigger. */
export const TINY_FONT_SEVERE_MIN_SEVERITY = 0.6
export const TINY_FONT_SEVERE_MIN_ROLE_WEIGHT = 0.8
export const TINY_FONT_SEVERE_MIN_INSTANCES = 5

/** Normalizes the weighted sum into a 0–1 "how much of the readability
 *  category's credit should this cost" ratio. Smaller K = harsher scoring. */
export const TINY_FONT_K = 2.5

/** 0 at the threshold, 1.0 at/below the severity floor, linear between. */
export function tinyFontSeverity(fontSizePx: number): number {
  const raw = (TINY_FONT_THRESHOLD_PX - fontSizePx) / (TINY_FONT_THRESHOLD_PX - TINY_FONT_SEVERITY_FLOOR_PX)
  return Math.max(0, Math.min(1, raw))
}

/** Groups tiny-font issues by their pre-computed style group key, weighs each
 *  group by severity × role × a capped repetition factor, and returns a 0–1
 *  ratio of how much of the readability category's credit this should cost.
 *  Contrast-unverifiable and other issue kinds are not part of this function
 *  at all — see buildVisualReport's readability section for how this result
 *  is combined with everything else. */
export function computeTinyFontRatioLost(issues: RawTextIssue[]): number {
  const groups = new Map<string, RawTextIssue[]>()
  for (const issue of issues) {
    const key = issue.groupKey ?? issue.sample
    const existing = groups.get(key)
    if (existing) existing.push(issue)
    else groups.set(key, [issue])
  }

  let weightedSum = 0
  let severeTriggered = false
  for (const groupIssues of groups.values()) {
    const { fontSizePx, role } = groupIssues[0]
    if (fontSizePx === undefined || role === undefined) continue
    const severity = tinyFontSeverity(fontSizePx)
    const roleWeight = TINY_FONT_ROLE_WEIGHTS[role]
    const instances = groupIssues.length
    const volumeFactor = Math.min(TINY_FONT_VOLUME_CAP, 1 + TINY_FONT_VOLUME_STEP * (instances - 1))
    weightedSum += severity * roleWeight * volumeFactor

    if (
      severity >= TINY_FONT_SEVERE_MIN_SEVERITY &&
      roleWeight >= TINY_FONT_SEVERE_MIN_ROLE_WEIGHT &&
      instances >= TINY_FONT_SEVERE_MIN_INSTANCES
    ) {
      severeTriggered = true
    }
  }

  if (severeTriggered) return 1
  return Math.min(1, weightedSum / TINY_FONT_K)
}

export function buildVisualReport(
  desktop: RawMeasurements | null,
  mobile: RawMeasurements | null,
  // Optional and defaulted to null so every existing 2-argument call site
  // (tests included) keeps working unchanged — only the overflow check below
  // reads this.
  tablet: RawMeasurements | null = null,
  // Same as tablet: optional, defaulted, only read by the overflow check.
  // A 320px-wide measurement, folded into the "mobile" flag there rather
  // than treated as its own category (see the comment above
  // overflowViewportLabel).
  narrow: RawMeasurements | null = null
): VisualReport {
  const findings: ScoredFinding[] = []
  let earned = 0
  let possible = 0
  let checksCompleted = 0

  // Crediting is deliberately folded INTO good()/improve() below, rather than
  // left as a separate call each check site must remember to make with a
  // matching ratio — a prior design required every check to call e.g.
  // `improve(id, ..., ratioLost)` and then separately `credit(id, 1 - ratioLost)`,
  // two numbers that had to be kept in sync by hand at 12 call sites. A
  // mismatch there would silently make the finding CARD say one thing while
  // the OVERALL SCORE reflected another. Folding credit() into the bucket
  // helpers makes that class of bug structurally impossible: there is now
  // exactly one place, per finding, where "how many points did this cost"
  // is decided, and it's the same number shown on the card.
  function credit(id: VisualCheckId, ratio: number) {
    const pts = VISUAL_CHECK_WEIGHTS[id]
    possible += pts
    earned += pts * Math.max(0, Math.min(1, ratio))
    checksCompleted += 1
  }
  function unverified(id: VisualCheckId, label: string, detail: string, viewport: FindingViewport) {
    // Genuinely not assessable — excluded from both earned and possible
    // (no credit() call at all), never counted as a failure.
    findings.push({ id, label, bucket: 'unverified', viewport, detail, measurable: false, points: 0 })
  }
  function good(id: VisualCheckId, label: string, detail: string, viewport: FindingViewport, measurable = true) {
    findings.push({ id, label, bucket: 'good', viewport, detail, measurable, points: VISUAL_CHECK_WEIGHTS[id] })
    credit(id, 1)
  }
  function improve(id: VisualCheckId, label: string, detail: string, viewport: FindingViewport, ratioLost: number, measurable = true) {
    // A measurable:false finding is a heuristic suggestion "best confirmed by
    // a human" (see VisualFinding's own field comment), not a confirmed,
    // deterministic failure — it must never silently cost the numeric score
    // the way a genuinely measured problem does. It still surfaces as an
    // 'improve' card for visibility (so it isn't lost or miscategorized as
    // "nothing to review"), just at full point value: the card's points and
    // the amount credited toward the total are the same number either way.
    const effectiveRatioLost = measurable ? ratioLost : 0
    findings.push({
      id,
      label,
      bucket: 'improve',
      viewport,
      detail,
      measurable,
      points: Math.round(VISUAL_CHECK_WEIGHTS[id] * (1 - effectiveRatioLost)),
    })
    credit(id, 1 - effectiveRatioLost)
  }

  if (!desktop && !mobile) {
    return {
      score: 0,
      findings: [
        {
          id: 'render',
          label: 'Rendered page review',
          bucket: 'unverified',
          viewport: 'both',
          detail:
            'This website could not be fully rendered in an automated browser, so the visual review could not run. That does not necessarily mean anything is wrong — some sites block automated visits.',
          measurable: false,
        },
      ],
      checksCompleted: 0,
      checksTotal: VISUAL_CHECK_COUNT,
    }
  }

  const currentYear = new Date().getFullYear()

  // ─── 1. Horizontal overflow ─────────────────────────────────
  // The only check that also measures an intermediate/tablet-width viewport
  // — a real bug reproduced only in that range (desktop and mobile both
  // clean), so a tablet-only overflow must be able to deduct score and be
  // reported, exactly like a desktop-only or mobile-only one always could.
  //
  // "Mobile" here is itself the OR of two measurements — 390px (mobile) and
  // 320px (narrow) — because a second real bug was later found that only
  // reproduced at 320px, with 390px clean. Either one overflowing makes the
  // combined mobile flag true; both must be absent for it to be null
  // (unmeasured), and if only one of the two loaded, its result is used
  // alone exactly as before narrow existed — so 390px coverage is never
  // weakened by narrow being unavailable.
  {
    const dOver = desktop ? desktop.overflow.overflowPx > 20 : null
    const tOver = tablet ? tablet.overflow.overflowPx > 20 : null
    const mOverRaw = mobile ? mobile.overflow.overflowPx > 20 : null
    const nOverRaw = narrow ? narrow.overflow.overflowPx > 20 : null
    const mobilePresent = !!mobile || !!narrow
    const mOver = mOverRaw === null && nOverRaw === null ? null : mOverRaw === true || nOverRaw === true
    if (dOver === null && tOver === null && mOver === null) {
      unverified('overflow', 'Horizontal overflow', 'Could not be measured for this page.', 'both')
    } else if (!dOver && !tOver && !mOver) {
      const measured = [desktop && 'desktop', tablet && 'tablet', mobilePresent && 'mobile'].filter((v): v is string => !!v)
      const missing = [!desktop && 'Desktop', !tablet && 'Tablet', !mobilePresent && 'Mobile'].filter((v): v is string => !!v)
      const note = missing.length > 0 ? ` (${formatViewportList(missing)} could not be measured for this page, so this reflects ${formatViewportList(measured)} only.)` : ''
      good(
        'overflow',
        'Horizontal overflow',
        `No unintended horizontal scrolling was detected at ${formatViewportList(measured)} widths.${note}`,
        overflowViewportLabel(!!desktop, !!tablet, mobilePresent)
      )
    } else {
      const affected = [dOver && 'desktop', tOver && 'tablet', mOver && 'mobile'].filter((v): v is string => !!v)
      const ratioLost = affected.length / 3
      improve(
        'overflow',
        'Horizontal overflow',
        `Page content extends beyond the visible width on ${formatViewportList(affected)}, creating unintended horizontal scrolling.`,
        overflowViewportLabel(!!dOver, !!tOver, !!mOver),
        ratioLost
      )
    }
  }

  // ─── 2. Overlap / clipping ────────────────────────────────────
  {
    const dIssues = desktop?.clippedOrOverlapping ?? []
    const mIssues = mobile?.clippedOrOverlapping ?? []
    const total = dIssues.length + mIssues.length
    const incomplete = isIncomplete(desktop?.incompleteCoverage?.overlap, mobile?.incompleteCoverage?.overlap)
    if (!desktop && !mobile) {
      unverified('overlap', 'Overlapping or clipped content', 'Could not be measured for this page.', 'both')
    } else if (incomplete) {
      unverified(
        'overlap',
        'Overlapping or clipped content',
        incompleteCoverageDetail(
          total > 0
            ? `Within the portion examined, ${total} instance${total === 1 ? '' : 's'} of visible content that ${total === 1 ? 'appears' : 'appear'} clipped, overlapping, or hidden behind a fixed header ${total === 1 ? 'was' : 'were'} found — shown here for context, not scored.`
            : 'No clipped or overlapping content was found within the portion examined.'
        ),
        availableViewport(desktop, mobile)
      )
    } else if (total === 0) {
      good(
        'overlap',
        'Overlapping or clipped content',
        `No clearly overlapping or clipped elements were detected.${partialCoverageNote(desktop, mobile)}`,
        availableViewport(desktop, mobile)
      )
    } else {
      const viewport = combineViewport(dIssues.length > 0, mIssues.length > 0)
      const ratioLost = Math.min(1, total / 4)
      improve(
        'overlap',
        'Overlapping or clipped content',
        `Found ${total} instance${total === 1 ? '' : 's'} of visible content that ${total === 1 ? 'appears' : 'appear'} clipped, overlapping, or hidden behind a fixed header on ${viewport === 'both' ? 'desktop and mobile' : viewport}.`,
        viewport,
        ratioLost
      )
    }
  }

  // ─── 3. Navigation ──────────────────────────────────────────
  {
    const d = desktop?.nav
    const m = mobile?.nav
    if (!d && !m) {
      unverified('navigation', 'Navigation availability & mobile usability', 'Could not be measured for this page.', 'both')
    } else {
      const problems: string[] = []
      let ratioLost = 0
      const navFoundAnywhere = (d && d.found) || (m && m.found)
      if (!navFoundAnywhere) {
        problems.push('No primary navigation region or recognizable navigation links were found.')
        ratioLost = 1
      } else {
        if (d && d.linksOverflowViewport) {
          problems.push('Some desktop navigation links extend beyond the visible width.')
          ratioLost += 0.3
        }
        if (m) {
          const hasUsableMobileNav = (m.menuButtonFound && m.menuButtonHasAccessibleName) || (m.found && !m.linksOverflowViewport)
          if (!hasUsableMobileNav) {
            if (m.menuButtonFound && !m.menuButtonHasAccessibleName) {
              problems.push('A mobile menu button was found, but it doesn’t have a label that people using screen readers can hear, which can make it harder for them to use.')
              ratioLost += 0.25
            } else if (!m.menuButtonFound && m.linksOverflowViewport) {
              problems.push('Some navigation links don’t fit on the mobile screen, and no mobile menu button was found to hold the rest.')
              ratioLost += 0.4
            }
          }
          if (m.stickyHeaderHeight !== null && mobile && m.stickyHeaderHeight / mobile.viewport.height > 0.22) {
            problems.push('The header that stays visible while scrolling takes up a large portion of the mobile screen.')
            ratioLost += 0.2
          }
        }
      }
      ratioLost = Math.min(1, ratioLost)
      if (problems.length === 0) {
        good(
          'navigation',
          'Navigation availability & mobile usability',
          `Navigation was found and appears usable at both desktop and mobile widths.${partialCoverageNote(d, m)}`,
          availableViewport(d, m)
        )
      } else {
        improve('navigation', 'Navigation availability & mobile usability', problems.join(' '), availableViewport(d, m), ratioLost)
      }
    }
  }

  // ─── 4. Logo / header proportions (low weight, suggestion) ──
  // Previously used `mobile?.logo?.found ? mobile.logo : desktop...` for the
  // ENTIRE logo object — if the chosen viewport's logo happened to be fine
  // while the OTHER viewport's rendering of the same logo was distorted or
  // overflowing, that problem was silently invisible. Each condition is now
  // OR-combined across whichever viewport(s) found a logo.
  {
    const d = desktop?.logo?.found ? desktop.logo : null
    const m = mobile?.logo?.found ? mobile.logo : null
    if (!d && !m) {
      unverified('logo', 'Logo & header proportions', 'No clear logo could be identified in the header, so this couldn’t be assessed.', 'both')
    } else {
      const problems: string[] = []
      let ratioLost = 0
      if (d?.overflowsContainer || m?.overflowsContainer) {
        problems.push('The logo appears to extend outside its container.')
        ratioLost += 0.4
      }
      if (d?.distortedAspectRatio || m?.distortedAspectRatio) {
        problems.push('The logo appears stretched out of its normal shape.')
        ratioLost += 0.3
      }
      if (d?.likelyBlurry || m?.likelyBlurry) {
        problems.push('The logo’s source image is much smaller than its rendered size, which can make it look blurry.')
        ratioLost += 0.2
      }
      // Screen-real-estate concern is inherently about the mobile viewport
      // specifically (a header taking up a large share of a small screen) —
      // uses mobile's own headerHeightRatio, not whichever viewport's logo
      // object happened to be picked.
      if (m?.headerHeightRatio !== null && m?.headerHeightRatio !== undefined && m.headerHeightRatio > 0.25) {
        problems.push('The header or logo takes up a large portion of the mobile screen. A manual review may help determine whether visitors can reach the main content quickly.')
        ratioLost += 0.2
      }
      ratioLost = Math.min(1, ratioLost)
      const viewport = availableViewport(d, m)
      if (problems.length === 0) {
        good('logo', 'Logo & header proportions', `The header logo renders at a reasonable, undistorted size.${partialCoverageNote(d, m)}`, viewport)
      } else {
        improve(
          'logo',
          'Logo & header proportions',
          `${problems.join(' ')} Treat this as a suggestion, not a rule — a manual look is the best way to confirm.`,
          viewport,
          ratioLost
        )
      }
    }
  }

  // ─── 5. Text readability ────────────────────────────────────
  {
    const dIssues = desktop?.textIssues ?? []
    const mIssues = mobile?.textIssues ?? []
    const readabilityIncomplete = isIncomplete(desktop?.incompleteCoverage?.textIssues, mobile?.incompleteCoverage?.textIssues)
    if (!desktop && !mobile) {
      unverified('readability', 'Text readability', 'Could not be measured for this page.', 'both')
    } else if (readabilityIncomplete) {
      const allIssues = [...dIssues, ...mIssues]
      const genuineIssues = allIssues.filter((i) => i.kind !== 'contrast-unverifiable')
      const seenSummary =
        genuineIssues.length > 0
          ? `Within the portion examined, ${genuineIssues.length} potential issue${genuineIssues.length === 1 ? '' : 's'} (small text, cramped spacing, long lines, or low contrast) ${genuineIssues.length === 1 ? 'was' : 'were'} found — shown here for context, not scored.`
          : 'No issues were found within the portion examined.'
      unverified('readability', 'Text readability', incompleteCoverageDetail(seenSummary), availableViewport(desktop, mobile))
    } else {
      const allIssues = [...dIssues, ...mIssues]
      // Contrast over a background image/gradient can't be reliably measured —
      // it's neither a confirmed problem (so it shouldn't cost score) nor a
      // confirmed pass (so it shouldn't be silently counted as "good" either).
      const genuineIssues = allIssues.filter((i) => i.kind !== 'contrast-unverifiable')
      const unverifiableCount = allIssues.length - genuineIssues.length

      if (genuineIssues.length === 0 && unverifiableCount === 0) {
        good(
          'readability',
          'Text readability',
          `No unusually small text, cramped line spacing, overly long lines, or low-contrast text was detected.${partialCoverageNote(desktop, mobile)}`,
          availableViewport(desktop, mobile)
        )
      } else if (genuineIssues.length === 0) {
        unverified(
          'readability',
          'Text readability',
          `${unverifiableCount} piece${unverifiableCount === 1 ? '' : 's'} of text sit${unverifiableCount === 1 ? 's' : ''} over a background image or gradient, so contrast couldn’t be reliably measured there. Everything else checked (font size, line spacing, line length) looked fine. A manual look is the best way to confirm this text is readable.`,
          combineViewport(
            dIssues.some((i) => i.kind === 'contrast-unverifiable'),
            mIssues.some((i) => i.kind === 'contrast-unverifiable')
          )
        )
      } else {
        const kinds = new Set(genuineIssues.map((i) => i.kind))
        const parts: string[] = []
        if (kinds.has('tiny-font')) parts.push('unusually small mobile text')
        if (kinds.has('tight-line-height')) parts.push('cramped line spacing')
        if (kinds.has('long-line')) parts.push('very long text lines on desktop')
        if (kinds.has('clipped')) parts.push('text clipped by its container')
        if (kinds.has('low-contrast')) parts.push('text with low contrast against its background')

        // tiny-font uses the severity/role/grouping model above; every other
        // genuine kind keeps the original "one instance = one unit out of ten"
        // treatment, since only tiny-font was found to over-penalize repeated,
        // low-severity, secondary-text instances.
        const tinyFontIssues = genuineIssues.filter((i) => i.kind === 'tiny-font')
        const otherGenuineCount = genuineIssues.length - tinyFontIssues.length
        const tinyFontRatioLost = computeTinyFontRatioLost(tinyFontIssues)
        const otherRatioLost = otherGenuineCount / 10
        const ratioLost = Math.min(1, otherRatioLost + tinyFontRatioLost)
        const unverifiableNote =
          unverifiableCount > 0
            ? ` ${unverifiableCount} additional piece${unverifiableCount === 1 ? '' : 's'} of text sit${unverifiableCount === 1 ? 's' : ''} over a background image or gradient and couldn’t be reliably checked for contrast.`
            : ''
        improve(
          'readability',
          'Text readability',
          `Found ${parts.join(', ')}.${unverifiableNote}`,
          combineViewport(dIssues.length > 0, mIssues.length > 0),
          ratioLost
        )
      }
    }
  }

  // ─── 6. Tap targets (mobile) ─────────────────────────────────
  {
    if (!mobile) {
      unverified('tapTargets', 'Tap-target sizing & spacing', 'Could not be measured for this page.', 'mobile')
    } else if (isIncomplete(mobile.incompleteCoverage?.tapTargets)) {
      const issues = mobile.tapTargets
      const seenSummary =
        issues.length > 0
          ? `Within the portion examined, ${issues.length} interactive element${issues.length === 1 ? '' : 's'} that ${issues.length === 1 ? 'appears' : 'appear'} undersized or crowded (e.g. "${issues[0].label || issues[0].tag}") ${issues.length === 1 ? 'was' : 'were'} found — shown here for context, not scored.`
          : 'No undersized or crowded elements were found within the portion examined.'
      unverified('tapTargets', 'Tap-target sizing & spacing', incompleteCoverageDetail(seenSummary), 'mobile')
    } else {
      const issues = mobile.tapTargets
      if (issues.length === 0) {
        good('tapTargets', 'Tap-target sizing & spacing', 'Interactive elements appear reasonably sized and spaced on mobile.', 'mobile')
      } else {
        const ratioLost = Math.min(1, issues.length / 6)
        improve(
          'tapTargets',
          'Tap-target sizing & spacing',
          `Found ${issues.length} interactive element${issues.length === 1 ? '' : 's'} on mobile that ${issues.length === 1 ? 'appears' : 'appear'} undersized or crowded (e.g. "${issues[0].label || issues[0].tag}").`,
          'mobile',
          ratioLost
        )
      }
    }
  }

  // ─── 7. Broken / distorted images ────────────────────────────
  {
    const dImgs = desktop?.images ?? []
    const mImgs = mobile?.images ?? []
    // Dedupe by src: the same image measured at both viewports should only count once.
    const bySrc = new Map<string, (typeof dImgs)[number]>()
    for (const img of [...dImgs, ...mImgs]) {
      const key = img.src || `${img.renderedWidth}x${img.renderedHeight}`
      if (!bySrc.has(key)) bySrc.set(key, img)
    }
    const all = Array.from(bySrc.values())
    const imagesIncomplete = isIncomplete(desktop?.incompleteCoverage?.images, mobile?.incompleteCoverage?.images)
    if (!desktop && !mobile) {
      unverified('images', 'Images', 'Could not be measured for this page.', 'both')
    } else if (imagesIncomplete) {
      const seenSummary =
        all.length > 0
          ? `Within the portion examined, ${all.length} image${all.length === 1 ? '' : 's'} ${all.length === 1 ? 'was' : 'were'} found — shown here for context, not scored.`
          : 'No images were found within the portion examined.'
      unverified('images', 'Images', incompleteCoverageDetail(seenSummary), availableViewport(desktop, mobile))
    } else if (all.length === 0) {
      good('images', 'Images', `No rendered images were found to check.${partialCoverageNote(desktop, mobile)}`, availableViewport(desktop, mobile))
    } else {
      const broken = all.filter((i) => i.visibleIntentionally && !i.loaded)
      const invisible = all.filter((i) => i.visibleIntentionally && i.loaded && (i.renderedWidth < 2 || i.renderedHeight < 2))
      const distorted = all.filter((i) => {
        if (!i.loaded || i.naturalWidth === 0) return false
        // cover/contain/scale-down/none crop or letterbox on purpose — they never
        // stretch pixels, so only the CSS default ('fill') can actually distort.
        if (i.objectFit !== 'fill') return false
        const naturalRatio = i.naturalWidth / i.naturalHeight
        const renderedRatio = i.renderedWidth / Math.max(1, i.renderedHeight)
        return Math.abs(naturalRatio - renderedRatio) / naturalRatio > 0.2
      })
      const missingAlt = all.filter((i) => i.alt === null && i.renderedWidth * i.renderedHeight > 1600)
      const issueCount = broken.length + invisible.length + distorted.length + missingAlt.length
      if (issueCount === 0) {
        good(
          'images',
          'Images',
          `Rendered images loaded correctly with reasonable proportions.${partialCoverageNote(desktop, mobile)}`,
          availableViewport(desktop, mobile)
        )
      } else {
        const parts: string[] = []
        if (broken.length) parts.push(`${broken.length} failed to load`)
        if (invisible.length) parts.push(`${invisible.length} rendered at zero size`)
        if (distorted.length) parts.push(`${distorted.length} appear stretched or distorted`)
        if (missingAlt.length) parts.push(`${missingAlt.length} meaningful image${missingAlt.length === 1 ? '' : 's'} missing descriptive text for screen readers (alt text)`)
        const ratioLost = Math.min(1, issueCount / 5)
        improve('images', 'Images', `Image issues found: ${parts.join(', ')}.`, combineViewport(dImgs.length > 0, mImgs.length > 0), ratioLost)
      }
    }
  }

  // ─── 8. Hero / above the fold ────────────────────────────────
  // Previously used `m || d` — whichever viewport succeeded first — for the
  // ENTIRE hero object, meaning a heading missing on ONE viewport only was
  // silently invisible whenever the OTHER viewport's data happened to win
  // the fallback. headingFound is now checked independently on each
  // available viewport: missing on either is a genuine problem for that
  // viewport's visitors, not something a passing result on the other side
  // should be able to paper over.
  {
    const d = desktop?.hero
    const m = mobile?.hero
    if (!d && !m) {
      unverified('hero', 'Hero & above-the-fold usability', 'Could not be measured for this page.', 'both')
    } else {
      const missingOnD = d ? !d.headingFound : false
      const missingOnM = m ? !m.headingFound : false
      if (missingOnD || missingOnM) {
        const bothMissing = missingOnD && missingOnM
        const viewport = combineViewport(missingOnD, missingOnM)
        improve(
          'hero',
          'Hero & above-the-fold usability',
          `No clear visible page heading was found near the top of the page${bothMissing ? '' : ` on ${viewport}`}.`,
          viewport,
          bothMissing ? 0.6 : 0.35
        )
      } else if (m && m.headingOutOfViewport) {
        improve(
          'hero',
          'Hero & above-the-fold usability',
          'The main heading appears unusually far down the mobile page — visitors may need to scroll several screens before reaching useful information. This is a suggestion for manual review, since intentional long-scroll designs exist.',
          'mobile',
          0.4,
          false
        )
      } else {
        good(
          'hero',
          'Hero & above-the-fold usability',
          `A clear heading is visible near the top of the page.${partialCoverageNote(d, m)}`,
          availableViewport(d, m)
        )
      }
    }
  }

  // ─── 9. Calls to action / contact paths ─────────────────────
  // Previously used `d || m` for the ENTIRE cta object — whenever desktop
  // measurement succeeded, mobile's hasContactLink/hasPrimaryAction were
  // never even read, so a mobile-exclusive contact link (e.g. a floating
  // "Call Now" button only shown at mobile widths) could never rescue this
  // check, and the site could be wrongly told it has no contact path at all.
  // Both signals are now OR-combined across whichever viewport(s) succeeded.
  {
    const d = desktop?.cta
    const m = mobile?.cta
    if (!d && !m) {
      unverified('cta', 'Calls to action & contact paths', 'Could not be measured for this page.', 'both')
    } else {
      const hasContactLink = !!(d?.hasContactLink || m?.hasContactLink)
      const hasPrimaryAction = !!(d?.hasPrimaryAction || m?.hasPrimaryAction)
      const ecommerce = !!(d?.ecommerceSignal || m?.ecommerceSignal)
      const viewport = availableViewport(d, m)
      if (!hasContactLink && !hasPrimaryAction) {
        if (ecommerce) {
          unverified(
            'cta',
            'Calls to action & contact paths',
            'This looks like an ecommerce/marketplace page. Contact-path expectations for this kind of site are different from a small-business service site, so this wasn’t scored the same way.',
            viewport
          )
        } else {
          improve(
            'cta',
            'Calls to action & contact paths',
            `No clear primary action or contact link (phone, email, contact link) was found on the homepage.${partialCoverageNote(d, m)}`,
            viewport,
            0.7
          )
        }
      } else {
        good(
          'cta',
          'Calls to action & contact paths',
          `A visible action or contact path (phone, email, or contact link) was found.${partialCoverageNote(d, m)}`,
          viewport
        )
      }
    }
  }

  // ─── 10. Heading structure ────────────────────────────────────
  // Previously used `desktop?.headings || mobile?.headings` — desktop's
  // structure entirely, whenever desktop succeeded — so a mobile-only
  // skipped heading level (a real, live example: responsive re-ordering can
  // change which heading level appears first on a narrow viewport) was
  // silently invisible. Every condition below is now OR-combined across
  // whichever viewport(s) succeeded: a structural problem that's real on
  // EITHER viewport is a real problem for that viewport's visitors.
  {
    const d = desktop?.headings
    const m = mobile?.headings
    if (!d && !m) {
      unverified('headings', 'Heading structure', 'Could not be measured for this page.', 'both')
    } else {
      let ratioLost = 0
      const problems: string[] = []
      const noH1OnD = d ? d.h1Count === 0 : false
      const noH1OnM = m ? m.h1Count === 0 : false
      const multiH1OnD = d ? d.h1Count > 1 : false
      const multiH1OnM = m ? m.h1Count > 1 : false
      let measurable = false
      if (noH1OnD || noH1OnM) {
        const both = noH1OnD && noH1OnM
        const viewport = combineViewport(noH1OnD, noH1OnM)
        problems.push(`No main page heading was found${both ? '' : ` on ${viewport}`}.`)
        ratioLost += 0.6
        measurable = true
      } else if (multiH1OnD || multiH1OnM) {
        const count = Math.max(d?.h1Count ?? 0, m?.h1Count ?? 0)
        const both = multiH1OnD && multiH1OnM
        const viewport = combineViewport(multiH1OnD, multiH1OnM)
        problems.push(`${count} main page headings were found${both ? '' : ` on ${viewport}`}, but a page should normally have only one.`)
        ratioLost += 0.4
        measurable = true
      }
      if (d?.hasSkippedLevel || m?.hasSkippedLevel) {
        const bothSkip = !!(d?.hasSkippedLevel && m?.hasSkippedLevel)
        const skipViewport = combineViewport(!!d?.hasSkippedLevel, !!m?.hasSkippedLevel)
        problems.push(
          `Heading levels appear to skip (e.g. jumping from a main heading straight to a smaller sub-heading, skipping the level in between)${bothSkip ? '' : ` on ${skipViewport}`}. This is a minor suggestion.`
        )
        ratioLost += 0.15
      }
      const emptyOnD = d?.emptyHeadingCount ?? 0
      const emptyOnM = m?.emptyHeadingCount ?? 0
      const emptyHeadingCount = Math.max(emptyOnD, emptyOnM)
      if (emptyHeadingCount > 0) {
        const bothEmpty = emptyOnD > 0 && emptyOnM > 0
        const emptyViewport = combineViewport(emptyOnD > 0, emptyOnM > 0)
        problems.push(
          `${emptyHeadingCount} heading${emptyHeadingCount === 1 ? '' : 's'} ${emptyHeadingCount === 1 ? 'appears' : 'appear'} to have no visible text${bothEmpty ? '' : ` on ${emptyViewport}`}.`
        )
        ratioLost += 0.15
      }
      ratioLost = Math.min(1, ratioLost)
      if (problems.length === 0) {
        good(
          'headings',
          'Heading structure',
          `A single clear main page heading and reasonable heading order were found.${partialCoverageNote(d, m)}`,
          availableViewport(d, m)
        )
      } else {
        improve('headings', 'Heading structure', problems.join(' '), availableViewport(d, m), ratioLost, measurable)
      }
    }
  }

  // ─── 11. Copyright / footer ──────────────────────────────────
  {
    const texts = [...(desktop?.copyrightTexts ?? []), ...(mobile?.copyrightTexts ?? [])]
    if (texts.length === 0) {
      improve('copyright', 'Footer copyright notice', 'No copyright notice was found in the footer. This is a low-priority suggestion, not a failure.', 'both', 0.35, false)
    } else {
      const years = Array.from(new Set(texts.join(' ').match(/\d{4}/g) || [])).map(Number)
      const hasPlaceholder = /20xx|yyyy/i.test(texts.join(' '))
      const future = years.filter((y) => y > currentYear)
      const rangeMatch = texts.join(' ').match(/(\d{4})\s*[-–—]\s*(\d{4})/)
      const reversed = rangeMatch ? Number(rangeMatch[1]) > Number(rangeMatch[2]) : false
      const stale = !reversed && years.length > 0 && Math.max(...years) < currentYear
      const conflicting = years.length > 2

      const problems: string[] = []
      let ratioLost = 0
      if (hasPlaceholder) {
        problems.push('A placeholder copyright year (e.g. "20XX") was found.')
        ratioLost += 0.5
      }
      if (future.length > 0) {
        problems.push(`A future copyright year (${future.join(', ')}) was found.`)
        ratioLost += 0.4
      }
      if (reversed) {
        problems.push('The copyright year range appears reversed.')
        ratioLost += 0.4
      }
      if (stale && !hasPlaceholder && !future.length) {
        problems.push(`The copyright year (${Math.max(...years)}) is older than the current year (${currentYear}).`)
        ratioLost += 0.25
      }
      if (conflicting) {
        problems.push('Multiple different copyright years were found, which may be worth reconciling.')
        ratioLost += 0.2
      }
      ratioLost = Math.min(1, ratioLost)
      if (problems.length === 0) {
        good('copyright', 'Footer copyright notice', `A copyright notice was found (${texts[0]}).`, 'both')
      } else {
        improve('copyright', 'Footer copyright notice', `${problems.join(' ')} A copyright detail like this has little effect on overall usability.`, 'both', ratioLost, false)
      }
    }
  }

  // ─── 12. Fixed overlays / obstructions ───────────────────────
  {
    const dOverlays = desktop?.overlays ?? []
    const mOverlays = mobile?.overlays ?? []
    if (!desktop && !mobile) {
      unverified('overlays', 'Fixed overlays & obstructions', 'Could not be measured for this page.', 'both')
    } else if (dOverlays.length === 0 && mOverlays.length === 0) {
      good('overlays', 'Fixed overlays & obstructions', 'No fixed elements (banners, chat widgets, popups) covering a large portion of the screen were detected.', 'both')
    } else {
      const worst = [...mOverlays, ...dOverlays].sort((a, b) => b.areaRatio - a.areaRatio)[0]
      const ratioLost = Math.min(1, worst.areaRatio + 0.3)
      improve(
        'overlays',
        'Fixed overlays & obstructions',
        `A fixed or sticky element covers roughly ${Math.round(worst.areaRatio * 100)}% of the ${mOverlays.length ? 'mobile' : 'desktop'} viewport, which may block content or controls.`,
        mOverlays.length ? 'mobile' : 'desktop',
        ratioLost
      )
    }
  }

  // Ecommerce/marketplace scope note — informational only, never scored, mirrors V1.
  if (desktop?.cta.ecommerceSignal || mobile?.cta.ecommerceSignal) {
    findings.push({
      id: 'ecommerce-visual',
      label: 'Ecommerce / marketplace',
      bucket: 'specialist',
      viewport: 'both',
      detail:
        'This appears to be an ecommerce or marketplace website. The visual review can check general layout basics, but it is not designed to evaluate product catalogs, checkout flows, marketplace listings, inventory, shipping, payments, or platform-specific integrations. These areas may require support from your platform provider or an ecommerce specialist.',
      measurable: false,
      points: 0,
    })
  }

  const score = possible > 0 ? Math.max(0, Math.min(100, Math.round((earned / possible) * 100))) : 0
  return { score, findings, checksCompleted, checksTotal: VISUAL_CHECK_COUNT }
}

/** The one-sentence status shown alongside the numeric score. Pulled out as
 *  its own pure function (rather than left inline in api/check-visual.ts) so
 *  it can be tested directly against a report, independent of the browser/
 *  network pipeline that produces one in production.
 *
 *  A perfect numeric score can still leave manual-review suggestions
 *  (measurable:false, never scored) or unverified checks (not assessable,
 *  excluded from both earned and possible) outstanding — 100 must never read
 *  as "nothing left to look at" when either is true. */
export function summarizeVisualReport(report: VisualReport): string {
  if (report.findings.some((f) => f.id === 'render')) {
    return 'This website could not be rendered for a visual review.'
  }
  const hasReviewItems = report.findings.some((f) => f.bucket === 'improve' || f.bucket === 'unverified')
  if (report.score === 100 && hasReviewItems) {
    return 'Measured checks look strong; review the items below.'
  }
  if (report.score >= 85) return 'The rendered page looks solid overall, with just a few small things worth a look.'
  if (report.score >= 65) return 'The rendered page is workable overall, with some room to improve.'
  if (report.score >= 40) return 'A few rendered-page issues could be affecting visitors.'
  return 'Several rendered-page issues were found — a closer look would likely help.'
}
