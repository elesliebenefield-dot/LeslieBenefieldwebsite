// Browser-side page measurement for the Visual & Usability Review.
//
// `collectPageMeasurements` is injected into the target page via Puppeteer's
// page.evaluate() and must be fully self-contained (no closures over outer
// variables — only its own parameters and standard DOM/window globals are
// available once it runs inside the target page).
//
// This module intentionally returns raw, structured measurements only. Turning
// those into scored findings happens back on the server (see api/check-visual.ts),
// keeping "what we measured" separate from "how we interpret it."

export type ViewportLabel = 'desktop' | 'mobile'

export interface RawImageMeasurement {
  src: string
  alt: string | null
  loaded: boolean
  naturalWidth: number
  naturalHeight: number
  renderedWidth: number
  renderedHeight: number
  visibleIntentionally: boolean
  /** cover/contain/scale-down/none intentionally decouple the box ratio from the
   *  image's natural ratio without stretching pixels — only 'fill' (the CSS default)
   *  actually stretches, so distortion should only be judged against that. */
  objectFit: string
}

export interface RawTapTarget {
  tag: string
  label: string
  width: number
  height: number
  minGapToNeighbor: number | null
}

export interface RawTextIssue {
  kind: 'tiny-font' | 'tight-line-height' | 'long-line' | 'clipped' | 'low-contrast'
  sample: string
  detail: string
}

export interface RawMeasurements {
  viewport: { width: number; height: number }
  overflow: { scrollWidth: number; clientWidth: number; overflowPx: number }
  clippedOrOverlapping: Array<{ kind: 'clipped' | 'overlap' | 'hidden-behind-header'; sample: string }>
  nav: {
    found: boolean
    linkCount: number
    linksOverflowViewport: boolean
    menuButtonFound: boolean
    menuButtonHasAccessibleName: boolean
    stickyHeaderHeight: number | null
  }
  logo: {
    found: boolean
    rendered: { width: number; height: number } | null
    natural: { width: number; height: number } | null
    overflowsContainer: boolean
    distortedAspectRatio: boolean
    likelyBlurry: boolean
    headerHeightRatio: number | null
  }
  textIssues: RawTextIssue[]
  tapTargets: RawTapTarget[]
  images: RawImageMeasurement[]
  hero: {
    headingFound: boolean
    headingTop: number | null
    headingOutOfViewport: boolean
    ctaFound: boolean
    ctaTop: number | null
  }
  cta: {
    hasContactLink: boolean
    hasPrimaryAction: boolean
    ecommerceSignal: boolean
  }
  headings: {
    h1Count: number
    hasSkippedLevel: boolean
    emptyHeadingCount: number
  }
  copyrightTexts: string[]
  overlays: Array<{ areaRatio: number; sample: string }>
}

/** Runs inside the target page. Must not reference anything outside its own body. */
export function collectPageMeasurements(viewportLabel: ViewportLabel): RawMeasurements {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  function isVisible(el: Element): boolean {
    const style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) return false
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  }

  function isSrOnly(el: Element): boolean {
    const style = window.getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    if (rect.width <= 1 && rect.height <= 1 && (style.position === 'absolute' || style.position === 'fixed')) return true
    if (style.clip === 'rect(0px, 0px, 0px, 0px)' || style.clipPath === 'inset(50%)') return true
    return false
  }

  // A wrapper whose only content is a nested element (e.g. a nav <li> around an
  // <a>) has no text of its own — its computed `color` is just whatever it
  // inherits, unrelated to the actually-visible text painted by its child. Text
  // and contrast checks should only ever evaluate the element that actually
  // renders the glyphs.
  function hasOwnText(el: Element): boolean {
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE && (node.textContent || '').trim().length > 0) return true
    }
    return false
  }

  function accessibleName(el: Element): string {
    const aria = el.getAttribute('aria-label')
    if (aria && aria.trim()) return aria.trim()
    const labelledBy = el.getAttribute('aria-labelledby')
    if (labelledBy) {
      const referenced = document.getElementById(labelledBy)
      if (referenced && referenced.textContent) return referenced.textContent.trim()
    }
    const title = el.getAttribute('title')
    if (title && title.trim()) return title.trim()
    return (el.textContent || '').trim()
  }

  // ─── 1. Horizontal overflow ────────────────────────────────
  const scrollWidth = document.documentElement.scrollWidth
  const clientWidth = document.documentElement.clientWidth
  const overflowPx = Math.max(0, scrollWidth - clientWidth)

  // ─── Sticky/fixed header detection (reused by nav + overlays) ─
  // aria-hidden="true" elements are explicitly marked decorative (e.g. a fixed
  // full-page background layer) — they're never a real header/nav or a content-
  // obstructing overlay, so they're excluded from both checks below.
  const fixedLikeEls = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter((el) => {
    const style = window.getComputedStyle(el)
    if (el.getAttribute('aria-hidden') === 'true') return false
    return (style.position === 'fixed' || style.position === 'sticky') && isVisible(el)
  })
  const topHeader = fixedLikeEls
    .filter((el) => {
      const rect = el.getBoundingClientRect()
      // A real header bar is a modest slice of the viewport, not most of it —
      // this rules out full-page fixed decorative layers being mistaken for one.
      return rect.top <= 4 && rect.height < viewportHeight * 0.5
    })
    .sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0]
  const stickyHeaderHeight = topHeader ? topHeader.getBoundingClientRect().height : null

  // ─── 2. Clipped / overlapping content ──────────────────────
  const clippedOrOverlapping: Array<{ kind: 'clipped' | 'overlap' | 'hidden-behind-header'; sample: string }> = []
  const importantEls = Array.from(
    document.querySelectorAll<HTMLElement>('h1, h2, nav a, header a, button, [role="button"], a.btn')
  ).filter(isVisible)

  for (const el of importantEls.slice(0, 60)) {
    const style = window.getComputedStyle(el)
    if (
      el.scrollWidth > el.clientWidth + 3 &&
      el.scrollHeight <= el.clientHeight + 1 &&
      (style.overflowX === 'hidden' || style.overflow === 'hidden') &&
      (el.textContent || '').trim().length > 0
    ) {
      clippedOrOverlapping.push({ kind: 'clipped', sample: (el.textContent || '').trim().slice(0, 60) })
    }
    if (stickyHeaderHeight !== null && el !== topHeader && !topHeader.contains(el)) {
      const rect = el.getBoundingClientRect()
      if (rect.top >= 0 && rect.top < stickyHeaderHeight - 2 && rect.bottom > 4) {
        clippedOrOverlapping.push({ kind: 'hidden-behind-header', sample: (el.textContent || '').trim().slice(0, 60) })
      }
    }
  }

  for (let i = 0; i < importantEls.length && i < 40; i++) {
    for (let j = i + 1; j < importantEls.length && j < 40; j++) {
      const a = importantEls[i]
      const b = importantEls[j]
      if (a.contains(b) || b.contains(a)) continue
      const ra = a.getBoundingClientRect()
      const rb = b.getBoundingClientRect()
      const ix = Math.max(0, Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left))
      const iy = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top))
      const overlapArea = ix * iy
      const smallerArea = Math.min(ra.width * ra.height, rb.width * rb.height)
      if (smallerArea > 16 && overlapArea / smallerArea > 0.5) {
        clippedOrOverlapping.push({
          kind: 'overlap',
          sample: `${(a.textContent || '').trim().slice(0, 30)} / ${(b.textContent || '').trim().slice(0, 30)}`,
        })
      }
    }
  }

  // ─── 3. Navigation ──────────────────────────────────────────
  const navEl = document.querySelector<HTMLElement>('nav, [role="navigation"], header nav')
  const navLinks = navEl ? Array.from(navEl.querySelectorAll<HTMLElement>('a')).filter(isVisible) : []
  const navLinksOverflow = navLinks.some((a) => a.getBoundingClientRect().right > viewportWidth + 2)
  const menuButtonCandidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'button, [role="button"], a'
    )
  ).filter((el) => {
    if (!isVisible(el)) return false
    const attrs = `${el.className} ${el.id} ${el.getAttribute('aria-label') || ''}`.toLowerCase()
    return /menu|hamburger|nav-?toggle/.test(attrs)
  })
  const menuButton = menuButtonCandidates[0] || null

  // ─── 4. Logo / header proportions ──────────────────────────
  const headerEl = document.querySelector<HTMLElement>('header') || navEl
  let logoEl: HTMLImageElement | HTMLElement | null = null
  if (headerEl) {
    logoEl =
      headerEl.querySelector<HTMLImageElement>('img[class*="logo" i], img[alt*="logo" i], img[id*="logo" i]') ||
      headerEl.querySelector<HTMLElement>('[class*="logo" i], [id*="logo" i]') ||
      headerEl.querySelector<HTMLImageElement>('img')
  }
  let logoMeasurement: RawMeasurements['logo'] = {
    found: false,
    rendered: null,
    natural: null,
    overflowsContainer: false,
    distortedAspectRatio: false,
    likelyBlurry: false,
    headerHeightRatio: null,
  }
  if (logoEl && isVisible(logoEl)) {
    const rect = logoEl.getBoundingClientRect()
    const container = logoEl.parentElement
    const containerRect = container ? container.getBoundingClientRect() : null
    const overflowsContainer = containerRect
      ? rect.width > containerRect.width + 2 || rect.height > containerRect.height + 2
      : false

    let natural: { width: number; height: number } | null = null
    let distortedAspectRatio = false
    let likelyBlurry = false
    if (logoEl instanceof HTMLImageElement && logoEl.naturalWidth > 0) {
      natural = { width: logoEl.naturalWidth, height: logoEl.naturalHeight }
      const naturalRatio = logoEl.naturalWidth / logoEl.naturalHeight
      const renderedRatio = rect.width / rect.height
      const objectFit = window.getComputedStyle(logoEl).objectFit || 'fill'
      // cover/contain/scale-down/none crop or letterbox on purpose — never stretch.
      distortedAspectRatio = objectFit === 'fill' && Math.abs(naturalRatio - renderedRatio) / naturalRatio > 0.15
      likelyBlurry = logoEl.naturalWidth < rect.width * 0.6
    }

    logoMeasurement = {
      found: true,
      rendered: { width: rect.width, height: rect.height },
      natural,
      overflowsContainer,
      distortedAspectRatio,
      likelyBlurry,
      headerHeightRatio: headerEl ? headerEl.getBoundingClientRect().height / viewportHeight : null,
    }
  }

  // ─── 5. Text readability ────────────────────────────────────
  const textIssues: RawTextIssue[] = []
  const textEls = Array.from(document.querySelectorAll<HTMLElement>('p, li, span, a, h1, h2, h3, h4')).filter(
    (el) => isVisible(el) && !isSrOnly(el) && hasOwnText(el) && (el.textContent || '').trim().length > 3
  )

  function relativeLuminance(r: number, g: number, b: number): number {
    const chan = (c: number) => {
      const v = c / 255
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b)
  }
  function parseRgb(color: string): [number, number, number, number] | null {
    const m = color.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/)
    if (!m) return null
    return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] !== undefined ? Number(m[4]) : 1]
  }
  function resolveBackground(el: HTMLElement): [number, number, number] | null {
    let node: HTMLElement | null = el
    for (let depth = 0; depth < 8 && node; depth++) {
      const bg = window.getComputedStyle(node).backgroundColor
      const parsed = parseRgb(bg)
      if (parsed && parsed[3] > 0.5) return [parsed[0], parsed[1], parsed[2]]
      node = node.parentElement
    }
    return [255, 255, 255] // fall back to assuming a light page background
  }

  let sampledForContrast = 0
  for (const el of textEls.slice(0, 120)) {
    const style = window.getComputedStyle(el)
    const fontSize = parseFloat(style.fontSize)
    const lineHeight = parseFloat(style.lineHeight)
    const sample = (el.textContent || '').trim().slice(0, 50)

    if (viewportLabel === 'mobile' && fontSize > 0 && fontSize < 12) {
      textIssues.push({ kind: 'tiny-font', sample, detail: `${fontSize.toFixed(0)}px` })
    }
    if (!Number.isNaN(lineHeight) && fontSize > 0 && lineHeight / fontSize < 1.1) {
      textIssues.push({ kind: 'tight-line-height', sample, detail: `${(lineHeight / fontSize).toFixed(2)}x` })
    }
    if (viewportLabel === 'desktop' && el.tagName === 'P' && el.clientWidth > 920 && (el.textContent || '').trim().length > 80) {
      textIssues.push({ kind: 'long-line', sample, detail: `${el.clientWidth}px wide` })
    }
    if (
      el.scrollWidth > el.clientWidth + 3 &&
      (style.overflowX === 'hidden' || style.textOverflow === 'clip') &&
      style.whiteSpace === 'nowrap'
    ) {
      textIssues.push({ kind: 'clipped', sample, detail: 'text wider than its container' })
    }

    if (sampledForContrast < 40 && fontSize >= 10) {
      const fg = parseRgb(style.color)
      const bg = resolveBackground(el)
      if (fg && bg) {
        const l1 = relativeLuminance(fg[0], fg[1], fg[2])
        const l2 = relativeLuminance(bg[0], bg[1], bg[2])
        const contrast = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
        if (contrast < 3.0) {
          textIssues.push({ kind: 'low-contrast', sample, detail: `~${contrast.toFixed(1)}:1` })
        }
        sampledForContrast++
      }
    }
  }

  // ─── 6. Tap targets (mobile) ────────────────────────────────
  const tapTargets: RawTapTarget[] = []
  if (viewportLabel === 'mobile') {
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        'nav a, header a, footer a, button, [role="button"], input[type="submit"], input[type="button"], li > a'
      )
    ).filter((el) => isVisible(el) && !(el.closest('p')))

    const rects = candidates.map((el) => ({ el, rect: el.getBoundingClientRect() }))
    for (let i = 0; i < rects.length && i < 80; i++) {
      const { el, rect } = rects[i]
      if (rect.width < 5 || rect.height < 5) continue
      let minGap: number | null = null
      for (let j = 0; j < rects.length; j++) {
        if (i === j) continue
        const other = rects[j].rect
        const dx = Math.max(rect.left - other.right, other.left - rect.right, 0)
        const dy = Math.max(rect.top - other.bottom, other.top - rect.bottom, 0)
        const gap = dx === 0 && dy === 0 ? 0 : Math.sqrt(dx * dx + dy * dy)
        if (minGap === null || gap < minGap) minGap = gap
      }
      if (rect.width < 40 || rect.height < 40 || (minGap !== null && minGap < 4)) {
        tapTargets.push({
          tag: el.tagName.toLowerCase(),
          label: accessibleName(el).slice(0, 40),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          minGapToNeighbor: minGap,
        })
      }
    }
  }

  // ─── 7. Images ───────────────────────────────────────────────
  const images: RawImageMeasurement[] = Array.from(document.querySelectorAll('img'))
    .slice(0, 40)
    .map((img) => {
      const rect = img.getBoundingClientRect()
      const style = window.getComputedStyle(img)
      const intentionallyHidden = style.display === 'none' || style.visibility === 'hidden' || img.getAttribute('aria-hidden') === 'true'
      return {
        src: img.currentSrc || img.src || '',
        alt: img.hasAttribute('alt') ? img.getAttribute('alt') : null,
        loaded: img.complete && img.naturalWidth > 0,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        renderedWidth: rect.width,
        renderedHeight: rect.height,
        visibleIntentionally: !intentionallyHidden,
        objectFit: style.objectFit || 'fill',
      }
    })

  // ─── 8. Hero / above the fold ─────────────────────────────────
  const heading = document.querySelector<HTMLElement>('h1') || document.querySelector<HTMLElement>('h2')
  const headingVisible = heading ? isVisible(heading) : false
  const headingTop = headingVisible ? heading!.getBoundingClientRect().top + window.scrollY : null
  const ctaEl = document.querySelector<HTMLElement>(
    'a.btn, a.btn-primary, button.btn, header a[href*="contact" i], main a[href*="contact" i], a[href^="tel:"], a[href^="mailto:"]'
  )
  const ctaVisible = ctaEl ? isVisible(ctaEl) : false
  const ctaTop = ctaVisible ? ctaEl!.getBoundingClientRect().top + window.scrollY : null

  // ─── 9. CTA / contact paths ─────────────────────────────────
  const hasContactLink = !!document.querySelector('a[href^="tel:"], a[href^="mailto:"], a[href*="contact" i]')
  const hasPrimaryAction = !!document.querySelector('a.btn, a.btn-primary, button.btn, [class*="cta" i]')
  const bodyText = (document.body.innerText || '').toLowerCase()
  const bodyHtml = document.body.innerHTML.toLowerCase()
  const ecommerceSignal =
    /add to cart|add-to-cart/.test(bodyText) ||
    /\/(cart|checkout)(\/|"|'|$)/.test(bodyHtml) ||
    document.querySelectorAll('a[href*="/cart"], a[href*="/checkout"], a[href*="/products/"], a[href*="/collections/"]').length > 2

  // ─── 10. Heading structure ──────────────────────────────────
  const allHeadings = Array.from(document.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')).filter(isVisible)
  const h1Count = allHeadings.filter((h) => h.tagName === 'H1').length
  const levels = allHeadings.map((h) => Number(h.tagName[1]))
  let hasSkippedLevel = false
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) hasSkippedLevel = true
  }
  if (levels.length > 0 && levels[0] > 2) hasSkippedLevel = true
  const emptyHeadingCount = allHeadings.filter((h) => (h.textContent || '').trim().length === 0).length

  // ─── 11. Footer / copyright ──────────────────────────────────
  // The year must immediately follow the © / "copyright" marker (only whitespace
  // in between) — this deliberately avoids swallowing unrelated digits from a
  // nearby phone number or address that happens to sit in the same footer.
  const footerEl = document.querySelector<HTMLElement>('footer')
  const footerText = footerEl ? footerEl.innerText || '' : ''
  const copyrightPattern = /(?:©|\(c\)|copyright)\s*(\d{4}|20XX|YYYY)(?:\s*[-–—]\s*(\d{4}|20XX|YYYY))?/gi
  const copyrightMatches = Array.from(footerText.matchAll(copyrightPattern)).map((m) => m[0].trim())
  const copyrightTexts = copyrightMatches.slice(0, 5)

  // ─── 12. Fixed overlays ───────────────────────────────────────
  const overlays = fixedLikeEls
    .filter((el) => el !== topHeader)
    .map((el) => {
      const rect = el.getBoundingClientRect()
      const area = (rect.width * rect.height) / (viewportWidth * viewportHeight)
      return { areaRatio: area, sample: (el.className || el.id || el.tagName).toString().slice(0, 60) }
    })
    .filter((o) => o.areaRatio > 0.15)

  return {
    viewport: { width: viewportWidth, height: viewportHeight },
    overflow: { scrollWidth, clientWidth, overflowPx },
    clippedOrOverlapping: clippedOrOverlapping.slice(0, 10),
    nav: {
      found: !!navEl && navLinks.length > 0,
      linkCount: navLinks.length,
      linksOverflowViewport: navLinksOverflow,
      menuButtonFound: !!menuButton,
      menuButtonHasAccessibleName: menuButton ? accessibleName(menuButton).length > 0 : false,
      stickyHeaderHeight,
    },
    logo: logoMeasurement,
    textIssues: textIssues.slice(0, 15),
    tapTargets: tapTargets.slice(0, 15),
    images,
    hero: {
      headingFound: headingVisible,
      headingTop,
      headingOutOfViewport: headingTop !== null && headingTop > viewportHeight * 2,
      ctaFound: ctaVisible,
      ctaTop,
    },
    cta: { hasContactLink, hasPrimaryAction, ecommerceSignal },
    headings: { h1Count, hasSkippedLevel, emptyHeadingCount },
    copyrightTexts,
    overlays: overlays.slice(0, 5),
  }
}
