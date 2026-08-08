// Pure scoring logic: turns raw browser measurements (see visualAnalysis.ts) into
// the Visual & Usability report. Deliberately has no browser/network dependency so
// it can be tested directly against synthetic measurement objects.

import type { RawMeasurements } from './visualAnalysis.js'
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

export function buildVisualReport(desktop: RawMeasurements | null, mobile: RawMeasurements | null): VisualReport {
  const findings: ScoredFinding[] = []
  let earned = 0
  let possible = 0
  let checksCompleted = 0

  function credit(id: VisualCheckId, ratio: number) {
    const pts = VISUAL_CHECK_WEIGHTS[id]
    possible += pts
    earned += pts * Math.max(0, Math.min(1, ratio))
    checksCompleted += 1
  }
  function unverified(id: VisualCheckId, label: string, detail: string, viewport: FindingViewport) {
    findings.push({ id, label, bucket: 'unverified', viewport, detail, measurable: false, points: 0 })
  }
  function good(id: VisualCheckId, label: string, detail: string, viewport: FindingViewport, measurable = true) {
    findings.push({ id, label, bucket: 'good', viewport, detail, measurable, points: VISUAL_CHECK_WEIGHTS[id] })
  }
  function improve(id: VisualCheckId, label: string, detail: string, viewport: FindingViewport, ratioLost: number, measurable = true) {
    findings.push({
      id,
      label,
      bucket: 'improve',
      viewport,
      detail,
      measurable,
      points: Math.round(VISUAL_CHECK_WEIGHTS[id] * (1 - ratioLost)),
    })
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
  {
    const dOver = desktop ? desktop.overflow.overflowPx > 20 : null
    const mOver = mobile ? mobile.overflow.overflowPx > 20 : null
    if (dOver === null && mOver === null) {
      unverified('overflow', 'Horizontal overflow', 'Could not be measured for this page.', 'both')
    } else if (!dOver && !mOver) {
      good('overflow', 'Horizontal overflow', 'No unintended horizontal scrolling was detected at desktop or mobile widths.', 'both')
      credit('overflow', 1)
    } else {
      const viewport = combineViewport(!!dOver, !!mOver)
      const both = dOver && mOver
      improve(
        'overflow',
        'Horizontal overflow',
        `Page content extends beyond the visible width on ${viewport === 'both' ? 'both desktop and mobile' : viewport}, creating unintended horizontal scrolling.`,
        viewport,
        both ? 1 : 0.5
      )
      credit('overflow', both ? 0 : 0.5)
    }
  }

  // ─── 2. Overlap / clipping ────────────────────────────────────
  {
    const dIssues = desktop?.clippedOrOverlapping ?? []
    const mIssues = mobile?.clippedOrOverlapping ?? []
    const total = dIssues.length + mIssues.length
    if (!desktop && !mobile) {
      unverified('overlap', 'Overlapping or clipped content', 'Could not be measured for this page.', 'both')
    } else if (total === 0) {
      good('overlap', 'Overlapping or clipped content', 'No clearly overlapping or clipped elements were detected.', 'both')
      credit('overlap', 1)
    } else {
      const viewport = combineViewport(dIssues.length > 0, mIssues.length > 0)
      const ratioLost = Math.min(1, total / 4)
      improve(
        'overlap',
        'Overlapping or clipped content',
        `Found ${total} instance${total === 1 ? '' : 's'} of visible content that appears clipped, overlapping, or hidden behind a fixed header on ${viewport === 'both' ? 'desktop and mobile' : viewport}.`,
        viewport,
        ratioLost
      )
      credit('overlap', 1 - ratioLost)
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
              problems.push('A mobile menu control was found, but it doesn’t have an accessible name (e.g. aria-label) for screen reader users.')
              ratioLost += 0.25
            } else if (!m.menuButtonFound && m.linksOverflowViewport) {
              problems.push('Navigation links overflow the mobile viewport and no mobile menu control was found.')
              ratioLost += 0.4
            }
          }
          if (m.stickyHeaderHeight !== null && mobile && m.stickyHeaderHeight / mobile.viewport.height > 0.22) {
            problems.push('A fixed/sticky header consumes a large portion of the mobile screen.')
            ratioLost += 0.2
          }
        }
      }
      ratioLost = Math.min(1, ratioLost)
      if (problems.length === 0) {
        good('navigation', 'Navigation availability & mobile usability', 'Navigation was found and appears usable at both desktop and mobile widths.', 'both')
        credit('navigation', 1)
      } else {
        improve('navigation', 'Navigation availability & mobile usability', problems.join(' '), combineViewport(true, true), ratioLost)
        credit('navigation', 1 - ratioLost)
      }
    }
  }

  // ─── 4. Logo / header proportions (low weight, suggestion) ──
  {
    const logo = mobile?.logo?.found ? mobile.logo : desktop?.logo?.found ? desktop.logo : null
    if (!logo) {
      unverified('logo', 'Logo & header proportions', 'No clear logo could be identified in the header, so this couldn’t be assessed.', 'both')
    } else {
      const problems: string[] = []
      let ratioLost = 0
      if (logo.overflowsContainer) {
        problems.push('The logo appears to extend outside its container.')
        ratioLost += 0.4
      }
      if (logo.distortedAspectRatio) {
        problems.push('The logo’s rendered proportions differ noticeably from its natural aspect ratio, suggesting it may be stretched.')
        ratioLost += 0.3
      }
      if (logo.likelyBlurry) {
        problems.push('The logo’s source image is much smaller than its rendered size, which can make it look blurry.')
        ratioLost += 0.2
      }
      if (logo.headerHeightRatio !== null && logo.headerHeightRatio > 0.25 && mobile) {
        problems.push('The header or logo takes up a large portion of the mobile screen. A manual review may help determine whether visitors can reach the main content quickly.')
        ratioLost += 0.2
      }
      ratioLost = Math.min(1, ratioLost)
      if (problems.length === 0) {
        good('logo', 'Logo & header proportions', 'The header logo renders at a reasonable, undistorted size.', 'both')
        credit('logo', 1)
      } else {
        improve('logo', 'Logo & header proportions', `${problems.join(' ')} Treat this as a suggestion, not a rule — a manual look is the best way to confirm.`, 'both', ratioLost)
        credit('logo', 1 - ratioLost)
      }
    }
  }

  // ─── 5. Text readability ────────────────────────────────────
  {
    const dIssues = desktop?.textIssues ?? []
    const mIssues = mobile?.textIssues ?? []
    if (!desktop && !mobile) {
      unverified('readability', 'Text readability', 'Could not be measured for this page.', 'both')
    } else {
      const total = dIssues.length + mIssues.length
      if (total === 0) {
        good('readability', 'Text readability', 'No unusually small text, cramped line spacing, overly long lines, or low-contrast text was detected.', 'both')
        credit('readability', 1)
      } else {
        const kinds = new Set([...dIssues, ...mIssues].map((i) => i.kind))
        const parts: string[] = []
        if (kinds.has('tiny-font')) parts.push('unusually small mobile text')
        if (kinds.has('tight-line-height')) parts.push('cramped line spacing')
        if (kinds.has('long-line')) parts.push('very long text lines on desktop')
        if (kinds.has('clipped')) parts.push('text clipped by its container')
        if (kinds.has('low-contrast')) parts.push('text with low contrast against its background')
        const ratioLost = Math.min(1, total / 10)
        improve(
          'readability',
          'Text readability',
          `Found ${parts.join(', ')}. Contrast is estimated from computed styles and may be inaccurate over images or gradients.`,
          combineViewport(dIssues.length > 0, mIssues.length > 0),
          ratioLost
        )
        credit('readability', 1 - ratioLost)
      }
    }
  }

  // ─── 6. Tap targets (mobile) ─────────────────────────────────
  {
    if (!mobile) {
      unverified('tapTargets', 'Tap-target sizing & spacing', 'Could not be measured for this page.', 'mobile')
    } else {
      const issues = mobile.tapTargets
      if (issues.length === 0) {
        good('tapTargets', 'Tap-target sizing & spacing', 'Interactive elements appear reasonably sized and spaced on mobile.', 'mobile')
        credit('tapTargets', 1)
      } else {
        const ratioLost = Math.min(1, issues.length / 6)
        improve(
          'tapTargets',
          'Tap-target sizing & spacing',
          `Found ${issues.length} interactive element${issues.length === 1 ? '' : 's'} on mobile that appear undersized or crowded (e.g. "${issues[0].label || issues[0].tag}").`,
          'mobile',
          ratioLost
        )
        credit('tapTargets', 1 - ratioLost)
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
    if (!desktop && !mobile) {
      unverified('images', 'Images', 'Could not be measured for this page.', 'both')
    } else if (all.length === 0) {
      good('images', 'Images', 'No rendered images were found to check.', 'both')
      credit('images', 1)
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
        good('images', 'Images', 'Rendered images loaded correctly with reasonable proportions.', 'both')
        credit('images', 1)
      } else {
        const parts: string[] = []
        if (broken.length) parts.push(`${broken.length} failed to load`)
        if (invisible.length) parts.push(`${invisible.length} rendered at zero size`)
        if (distorted.length) parts.push(`${distorted.length} appear stretched or distorted`)
        if (missingAlt.length) parts.push(`${missingAlt.length} meaningful image${missingAlt.length === 1 ? '' : 's'} missing alt text`)
        const ratioLost = Math.min(1, issueCount / 5)
        improve('images', 'Images', `Image issues found: ${parts.join(', ')}.`, combineViewport(dImgs.length > 0, mImgs.length > 0), ratioLost)
        credit('images', 1 - ratioLost)
      }
    }
  }

  // ─── 8. Hero / above the fold ────────────────────────────────
  {
    const m = mobile?.hero
    const d = desktop?.hero
    const ref = m || d
    if (!ref) {
      unverified('hero', 'Hero & above-the-fold usability', 'Could not be measured for this page.', 'both')
    } else if (!ref.headingFound) {
      improve('hero', 'Hero & above-the-fold usability', 'No clear visible page heading was found near the top of the page.', 'both', 0.6)
      credit('hero', 0.4)
    } else if (m && m.headingOutOfViewport) {
      improve(
        'hero',
        'Hero & above-the-fold usability',
        'The main heading appears unusually far down the mobile page — visitors may need to scroll several screens before reaching useful information. This is a suggestion for manual review, since intentional long-scroll designs exist.',
        'mobile',
        0.4,
        false
      )
      credit('hero', 0.6)
    } else {
      good('hero', 'Hero & above-the-fold usability', 'A clear heading is visible near the top of the page.', 'both')
      credit('hero', 1)
    }
  }

  // ─── 9. Calls to action / contact paths ─────────────────────
  {
    const d = desktop?.cta
    const m = mobile?.cta
    const ref = d || m
    const ecommerce = !!(d?.ecommerceSignal || m?.ecommerceSignal)
    if (!ref) {
      unverified('cta', 'Calls to action & contact paths', 'Could not be measured for this page.', 'both')
    } else if (!ref.hasContactLink && !ref.hasPrimaryAction) {
      if (ecommerce) {
        unverified(
          'cta',
          'Calls to action & contact paths',
          'This looks like an ecommerce/marketplace page. Contact-path expectations for this kind of site are different from a small-business service site, so this wasn’t scored the same way.',
          'both'
        )
      } else {
        improve('cta', 'Calls to action & contact paths', 'No clear primary action or contact link (phone, email, contact link) was found on the homepage.', 'both', 0.7)
        credit('cta', 0.3)
      }
    } else {
      good('cta', 'Calls to action & contact paths', 'A visible action or contact path (phone, email, or contact link) was found.', 'both')
      credit('cta', 1)
    }
  }

  // ─── 10. Heading structure ────────────────────────────────────
  {
    const ref = desktop?.headings || mobile?.headings
    if (!ref) {
      unverified('headings', 'Heading structure', 'Could not be measured for this page.', 'both')
    } else {
      let ratioLost = 0
      const problems: string[] = []
      if (ref.h1Count === 0) {
        problems.push('No H1 heading was found.')
        ratioLost += 0.6
      } else if (ref.h1Count > 1) {
        problems.push(`${ref.h1Count} H1 headings were found on the page.`)
        ratioLost += 0.4
      }
      if (ref.hasSkippedLevel) {
        problems.push('Heading levels appear to skip (e.g. jumping from H1 to H3 or below). This is a minor suggestion.')
        ratioLost += 0.15
      }
      if (ref.emptyHeadingCount > 0) {
        problems.push(`${ref.emptyHeadingCount} heading${ref.emptyHeadingCount === 1 ? '' : 's'} appear to have no visible text.`)
        ratioLost += 0.15
      }
      ratioLost = Math.min(1, ratioLost)
      if (problems.length === 0) {
        good('headings', 'Heading structure', 'A single clear H1 and reasonable heading order were found.', 'both')
        credit('headings', 1)
      } else {
        improve('headings', 'Heading structure', problems.join(' '), 'both', ratioLost, ref.h1Count === 0 || ref.h1Count > 1)
        credit('headings', 1 - ratioLost)
      }
    }
  }

  // ─── 11. Copyright / footer ──────────────────────────────────
  {
    const texts = [...(desktop?.copyrightTexts ?? []), ...(mobile?.copyrightTexts ?? [])]
    if (texts.length === 0) {
      improve('copyright', 'Footer copyright notice', 'No copyright notice was found in the footer. This is a low-priority suggestion, not a failure.', 'both', 0.35, false)
      credit('copyright', 0.65)
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
        credit('copyright', 1)
      } else {
        improve('copyright', 'Footer copyright notice', `${problems.join(' ')} A copyright detail like this has little effect on overall usability.`, 'both', ratioLost, false)
        credit('copyright', 1 - ratioLost)
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
      credit('overlays', 1)
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
      credit('overlays', 1 - ratioLost)
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
