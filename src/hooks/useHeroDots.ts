import { useEffect, type RefObject } from 'react'

const DOT_COUNT = 14
// Kept well clear of the card: dots only ever get laid out inside margin
// strips computed from the card's own measured rect (see layoutDots).
// BUFFER_PX is comfortably bigger than MAX_PUSH_PX so even a dot pushed
// its full ripple distance can't reach the card — and rippleAt() below
// additionally hard-clamps against the card's live rect every frame, so
// this holds regardless of viewport size or pointer geometry, not just
// "usually". MIN_REGION_SIZE_PX is intentionally small: on a typical
// phone, the hero card leaves only a ~20-35px strip above/below itself
// (there's essentially no side margin at all once the card is nearly
// full-width) — that was measured directly, not guessed, after an
// earlier version of this file used thresholds that left every mobile
// viewport with zero valid regions and silently hid every dot.
const BUFFER_PX = 16
const EDGE_PADDING_PX = 6
const MIN_REGION_SIZE_PX = 20

const POINTER_RADIUS_PX = 110
const MAX_PUSH_PX = 9
const LINK_DISTANCE_PX = 130
const MAX_LINES = 3
const TOUCH_RIPPLE_HOLD_MS = 550
// Extra margin (beyond the card's own rect) that a dot's CURRENT
// (rest + push) position must never enter — the hard safety clamp in
// rippleAt(), independent of how generous BUFFER_PX above turns out to
// be for any given layout.
const CARD_CLEARANCE_PX = 6

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

interface DotLayout {
  restX: number
  restY: number
  baseOpacity: number
}

function seededRandom(seed: number) {
  // Small deterministic PRNG (mulberry32) — not for security, just so a
  // given dot index/region always produces a stable-feeling distribution
  // within one layout pass rather than clustering unpredictably.
  let t = seed + 0x6d2b79f5
  return function next() {
    t = (t + 0x6d2b79f5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Computes up to four margin regions (left/right/top/bottom of the card,
 *  within the section) and distributes DOT_COUNT dots across whichever
 *  regions are large enough to be worth using — this is what guarantees
 *  dots (and their maximum ripple displacement) never reach the card,
 *  at any viewport width, including ones where the card leaves almost no
 *  side margin at all (dots then land only above/below it). */
function layoutDots(section: Rect, card: Rect): DotLayout[] {
  const cardLeft = card.x - section.x
  const cardTop = card.y - section.y
  const cardRight = cardLeft + card.width
  const cardBottom = cardTop + card.height

  const regions: { x0: number; y0: number; x1: number; y1: number; area: number }[] = []

  const leftW = cardLeft - BUFFER_PX - EDGE_PADDING_PX
  if (leftW > MIN_REGION_SIZE_PX) {
    regions.push({ x0: EDGE_PADDING_PX, y0: EDGE_PADDING_PX, x1: cardLeft - BUFFER_PX, y1: section.height - EDGE_PADDING_PX, area: leftW * section.height })
  }
  const rightW = section.width - EDGE_PADDING_PX - (cardRight + BUFFER_PX)
  if (rightW > MIN_REGION_SIZE_PX) {
    regions.push({ x0: cardRight + BUFFER_PX, y0: EDGE_PADDING_PX, x1: section.width - EDGE_PADDING_PX, y1: section.height - EDGE_PADDING_PX, area: rightW * section.height })
  }
  const topH = cardTop - BUFFER_PX - EDGE_PADDING_PX
  if (topH > MIN_REGION_SIZE_PX) {
    regions.push({ x0: EDGE_PADDING_PX, y0: EDGE_PADDING_PX, x1: section.width - EDGE_PADDING_PX, y1: cardTop - BUFFER_PX, area: section.width * topH })
  }
  const bottomH = section.height - EDGE_PADDING_PX - (cardBottom + BUFFER_PX)
  if (bottomH > MIN_REGION_SIZE_PX) {
    regions.push({ x0: EDGE_PADDING_PX, y0: cardBottom + BUFFER_PX, x1: section.width - EDGE_PADDING_PX, y1: section.height - EDGE_PADDING_PX, area: section.width * bottomH })
  }

  if (regions.length === 0) return []

  const totalArea = regions.reduce((sum, r) => sum + r.area, 0)
  const rand = seededRandom(Math.round(section.width) * 31 + Math.round(section.height))
  const layouts: DotLayout[] = []

  for (let i = 0; i < DOT_COUNT; i++) {
    // Weighted-by-area region pick so a tall/short viewport naturally
    // gets proportionally more dots in whichever margins are actually big.
    let pick = rand() * totalArea
    let region = regions[regions.length - 1]
    for (const r of regions) {
      if (pick < r.area) {
        region = r
        break
      }
      pick -= r.area
    }
    layouts.push({
      restX: region.x0 + rand() * (region.x1 - region.x0),
      restY: region.y0 + rand() * (region.y1 - region.y0),
      baseOpacity: 0.35 + rand() * 0.3,
    })
  }
  return layouts
}

function toRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, width: r.width, height: r.height }
}

/** Renders and animates the Hero's "sea glass" dot field: a static,
 *  runtime-computed arrangement in the margins around the card, with an
 *  optional interactive ripple/connecting-lines effect layered on top —
 *  pointer-driven on hover-capable desktops, a single calm tap-ripple on
 *  touch devices, and no interaction/movement at all under
 *  prefers-reduced-motion (dots still render, just never move). Every
 *  listener is attached to the section element, never to the decorative
 *  dots/SVG layers themselves, which stay pointer-events:none — clicks
 *  and keyboard focus on the card/buttons are never at risk regardless of
 *  what this hook does. */
export function useHeroDots(
  sectionRef: RefObject<HTMLElement | null>,
  cardRef: RefObject<HTMLElement | null>,
  dotsContainerRef: RefObject<HTMLDivElement | null>,
  svgRef: RefObject<SVGSVGElement | null>
) {
  useEffect(() => {
    const section = sectionRef.current
    const card = cardRef.current
    const dotsContainer = dotsContainerRef.current
    const svg = svgRef.current
    if (!section || !card || !dotsContainer || !svg) return

    const dotEls = Array.from(dotsContainer.children) as HTMLElement[]
    const linePool = Array.from(svg.querySelectorAll('line'))
    let layout: DotLayout[] = []

    function applyLayout() {
      if (!section || !card) return
      layout = layoutDots(toRect(section), toRect(card))
      svg?.setAttribute('viewBox', `0 0 ${section!.clientWidth} ${section!.clientHeight}`)
      dotEls.forEach((dot, i) => {
        const d = layout[i]
        if (!d) {
          dot.style.display = 'none'
          return
        }
        dot.style.display = ''
        dot.style.left = `${d.restX}px`
        dot.style.top = `${d.restY}px`
        dot.style.opacity = String(d.baseOpacity)
        dot.style.transform = 'translate(0px, 0px)'
      })
    }

    applyLayout()

    const resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(resizeDebounce)
      resizeDebounce = window.setTimeout(applyLayout, 150)
    })
    let resizeDebounce = 0
    resizeObserver.observe(section)

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      // Static, attractive arrangement only — no listeners attached at all.
      return () => {
        resizeObserver.disconnect()
        window.clearTimeout(resizeDebounce)
      }
    }

    function resetAll() {
      dotEls.forEach((dot, i) => {
        const d = layout[i]
        if (!d) return
        dot.style.transform = 'translate(0px, 0px)'
        dot.style.opacity = String(d.baseOpacity)
      })
      linePool.forEach((line) => line.setAttribute('opacity', '0'))
    }

    function rippleAt(px: number, py: number) {
      // Hard safety clamp, independent of BUFFER_PX/region placement above:
      // measured fresh each call (cheap — only runs on actual pointer
      // activity, never in an idle loop) so it stays correct even if the
      // card's size/position changes without a resize event (e.g. content
      // reflow). No dot's current (rest + push) position is ever allowed
      // inside this expanded rect, full stop.
      if (!section || !card) return
      const sectionRect = section.getBoundingClientRect()
      const cardRect = card.getBoundingClientRect()
      const forbidden = {
        left: cardRect.left - sectionRect.left - CARD_CLEARANCE_PX,
        top: cardRect.top - sectionRect.top - CARD_CLEARANCE_PX,
        right: cardRect.right - sectionRect.left + CARD_CLEARANCE_PX,
        bottom: cardRect.bottom - sectionRect.top + CARD_CLEARANCE_PX,
      }
      const insideForbidden = (x: number, y: number) => x > forbidden.left && x < forbidden.right && y > forbidden.top && y < forbidden.bottom

      const active: { i: number; x: number; y: number }[] = []
      dotEls.forEach((dot, i) => {
        const d = layout[i]
        if (!d) return
        const dx = d.restX - px
        const dy = d.restY - py
        const dist = Math.hypot(dx, dy)
        if (dist < POINTER_RADIUS_PX && dist > 0.001) {
          const strength = (1 - dist / POINTER_RADIUS_PX) * MAX_PUSH_PX
          let pushX = (dx / dist) * strength
          let pushY = (dy / dist) * strength
          if (insideForbidden(d.restX + pushX, d.restY + pushY)) {
            pushX = 0
            pushY = 0
          }
          dot.style.transform = `translate(${pushX.toFixed(1)}px, ${pushY.toFixed(1)}px)`
          dot.style.opacity = String(Math.min(0.95, d.baseOpacity + 0.3))
          active.push({ i, x: d.restX + pushX, y: d.restY + pushY })
        } else {
          dot.style.transform = 'translate(0px, 0px)'
          dot.style.opacity = String(d.baseOpacity)
        }
      })

      const pairs: [typeof active[number], typeof active[number]][] = []
      const used = new Set<string>()
      for (const a of active) {
        let best: (typeof active)[number] | null = null
        let bestDist = LINK_DISTANCE_PX
        for (const b of active) {
          if (a.i === b.i) continue
          const key = a.i < b.i ? `${a.i}-${b.i}` : `${b.i}-${a.i}`
          if (used.has(key)) continue
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d < bestDist) {
            bestDist = d
            best = b
          }
        }
        if (best) {
          const key = a.i < best.i ? `${a.i}-${best.i}` : `${best.i}-${a.i}`
          used.add(key)
          pairs.push([a, best])
          if (pairs.length >= MAX_LINES) break
        }
      }
      linePool.forEach((line, idx) => {
        const pair = pairs[idx]
        if (pair) {
          line.setAttribute('x1', pair[0].x.toFixed(1))
          line.setAttribute('y1', pair[0].y.toFixed(1))
          line.setAttribute('x2', pair[1].x.toFixed(1))
          line.setAttribute('y2', pair[1].y.toFixed(1))
          line.setAttribute('opacity', '0.32')
        } else {
          line.setAttribute('opacity', '0')
        }
      })
    }

    const hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)').matches

    if (hoverCapable) {
      let frame = 0
      const handleMove = (e: PointerEvent) => {
        if (frame) return
        frame = requestAnimationFrame(() => {
          frame = 0
          if (!section) return
          const rect = section.getBoundingClientRect()
          rippleAt(e.clientX - rect.left, e.clientY - rect.top)
        })
      }
      const handleLeave = () => resetAll()
      section.addEventListener('pointermove', handleMove)
      section.addEventListener('pointerleave', handleLeave)
      return () => {
        section.removeEventListener('pointermove', handleMove)
        section.removeEventListener('pointerleave', handleLeave)
        if (frame) cancelAnimationFrame(frame)
        resizeObserver.disconnect()
        window.clearTimeout(resizeDebounce)
      }
    }

    // Touch/non-hover: a single calm ripple on tap in the background area
    // only — never when the tap landed on the card (its buttons/links
    // handle their own taps completely normally; this listener never
    // calls preventDefault/stopPropagation, so it can't interfere either
    // way even on a tap that does land on the card).
    let touchResetTimer = 0
    const handleTap = (e: PointerEvent) => {
      if (!section) return
      const target = e.target as HTMLElement | null
      if (target?.closest('.hero-inner')) return
      const rect = section.getBoundingClientRect()
      rippleAt(e.clientX - rect.left, e.clientY - rect.top)
      window.clearTimeout(touchResetTimer)
      touchResetTimer = window.setTimeout(resetAll, TOUCH_RIPPLE_HOLD_MS)
    }
    section.addEventListener('pointerdown', handleTap)
    return () => {
      section.removeEventListener('pointerdown', handleTap)
      window.clearTimeout(touchResetTimer)
      resizeObserver.disconnect()
      window.clearTimeout(resizeDebounce)
    }
  }, [sectionRef, cardRef, dotsContainerRef, svgRef])
}
