import { useEffect, type RefObject } from 'react'

// Dot count itself lives in Hero.tsx (it renders the <span> elements) —
// this file just positions whatever children .hero-dots was given.
const EDGE_PADDING_PX = 10

const RIPPLE_THROTTLE_MS = 220
// Ripple/burst animation durations live in index.css's
// .hero-ripple-ring/.hero-burst-dot @keyframes (1.2s / 0.95s) — each
// element removes itself on its own 'animationend', so nothing here needs
// to duplicate or track those durations directly.
const BURST_DOT_COUNT = 3
// Defensive cap on live DOM nodes if events ever outpace their own
// animationend cleanup — normal use never gets close to this.
const MAX_ALIVE_FX_NODES = 48

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function seededRandom(seed: number) {
  // Small deterministic PRNG (mulberry32) — just so the dot field has a
  // stable, non-clustering-looking distribution rather than depending on
  // Math.random()'s actual sequence; not used for anything security-
  // sensitive.
  let t = seed + 0x6d2b79f5
  return function next() {
    t = (t + 0x6d2b79f5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function toRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect()
  return { x: r.left, y: r.top, width: r.width, height: r.height }
}

/** Renders the Hero's "sea glass" background: a calm, static scatter of
 *  small dots, plus (outside prefers-reduced-motion) an expanding-ripple
 *  response to pointer movement/taps in the background area.
 *
 *  Safety model: every visual element (dots, ripples, burst-dots) lives
 *  inside a container clipped with an SVG clip-path that cuts a
 *  rectangular hole exactly matching the card's live measured rect — so
 *  nothing can ever be seen over the card, its text, or its buttons,
 *  regardless of where a ripple spawns or how large it grows. This is a
 *  visual guarantee, not a "stay in your lane" positioning convention,
 *  which is what actually makes "strictly behind the card" hold even as
 *  ripples expand past their spawn point. Every pointer/touch listener is
 *  attached to the section element itself, never to the decorative
 *  layers (which stay pointer-events:none unconditionally), so clicks
 *  and keyboard focus on the card/buttons are structurally unaffected. */
export function useHeroDots(
  sectionRef: RefObject<HTMLElement | null>,
  cardRef: RefObject<HTMLElement | null>,
  dotsContainerRef: RefObject<HTMLDivElement | null>,
  rippleContainerRef: RefObject<HTMLDivElement | null>,
  clipPathRef: RefObject<SVGPathElement | null>
) {
  useEffect(() => {
    const section = sectionRef.current
    const card = cardRef.current
    const dotsContainer = dotsContainerRef.current
    const rippleContainer = rippleContainerRef.current
    const clipPath = clipPathRef.current
    if (!section || !card || !dotsContainer || !rippleContainer || !clipPath) return

    const dotEls = Array.from(dotsContainer.children) as HTMLElement[]

    function layoutDots() {
      if (!section) return
      const s = toRect(section)
      const rand = seededRandom(Math.round(s.width) * 31 + Math.round(s.height))
      dotEls.forEach((dot) => {
        const x = EDGE_PADDING_PX + rand() * (s.width - EDGE_PADDING_PX * 2)
        const y = EDGE_PADDING_PX + rand() * (s.height - EDGE_PADDING_PX * 2)
        dot.style.left = `${x}px`
        dot.style.top = `${y}px`
        dot.style.opacity = String(0.4 + rand() * 0.3)
      })
    }

    function updateClipPath() {
      if (!section || !card || !clipPath) return
      const s = toRect(section)
      const c = toRect(card)
      const left = c.x - s.x
      const top = c.y - s.y
      const right = left + c.width
      const bottom = top + c.height
      // Outer rect (the whole section) plus the card's rect traced in the
      // reverse winding direction — combined with fill-rule="evenodd" on
      // the <path> (set in Hero.tsx) that punches a hole exactly where
      // the card is, regardless of its current measured size/position.
      clipPath.setAttribute(
        'd',
        `M0,0 H${s.width} V${s.height} H0 Z M${left},${top} H${right} V${bottom} H${left} Z`
      )
    }

    function applyLayout() {
      layoutDots()
      updateClipPath()
    }

    applyLayout()

    let resizeDebounce = 0
    const resizeObserver = new ResizeObserver(() => {
      window.clearTimeout(resizeDebounce)
      resizeDebounce = window.setTimeout(applyLayout, 150)
    })
    resizeObserver.observe(section)

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      // Still, attractive background only — no ripple listeners attached
      // at all, so no movement or interaction can ever occur.
      return () => {
        resizeObserver.disconnect()
        window.clearTimeout(resizeDebounce)
      }
    }

    function spawnRipple(x: number, y: number) {
      if (!rippleContainer) return
      if (rippleContainer.childElementCount >= MAX_ALIVE_FX_NODES) return

      const ring = document.createElement('span')
      ring.className = 'hero-ripple-ring'
      ring.style.left = `${x}px`
      ring.style.top = `${y}px`
      ring.addEventListener('animationend', () => ring.remove(), { once: true })
      rippleContainer.appendChild(ring)

      for (let i = 0; i < BURST_DOT_COUNT; i++) {
        const angle = Math.random() * Math.PI * 2
        const dist = 16 + Math.random() * 24
        const dx = Math.cos(angle) * dist
        const dy = Math.sin(angle) * dist
        const dot = document.createElement('span')
        dot.className = 'hero-burst-dot'
        dot.style.left = `${x}px`
        dot.style.top = `${y}px`
        dot.style.setProperty('--dx', `${dx.toFixed(1)}px`)
        dot.style.setProperty('--dy', `${dy.toFixed(1)}px`)
        dot.addEventListener('animationend', () => dot.remove(), { once: true })
        rippleContainer.appendChild(dot)
      }
    }

    const hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)').matches

    if (hoverCapable) {
      let lastSpawn = 0
      const handleMove = (e: PointerEvent) => {
        const now = performance.now()
        if (now - lastSpawn < RIPPLE_THROTTLE_MS) return
        lastSpawn = now
        if (!section) return
        const rect = section.getBoundingClientRect()
        spawnRipple(e.clientX - rect.left, e.clientY - rect.top)
      }
      section.addEventListener('pointermove', handleMove)
      return () => {
        section.removeEventListener('pointermove', handleMove)
        resizeObserver.disconnect()
        window.clearTimeout(resizeDebounce)
      }
    }

    // Touch/non-hover: one clearly visible ripple per tap in the
    // background area only — never on the card (its buttons/links handle
    // their own taps completely normally; this listener never calls
    // preventDefault/stopPropagation, so normal scrolling and tapping are
    // never affected either way).
    const handleTap = (e: PointerEvent) => {
      if (!section) return
      const target = e.target as HTMLElement | null
      if (target?.closest('.hero-inner')) return
      const rect = section.getBoundingClientRect()
      spawnRipple(e.clientX - rect.left, e.clientY - rect.top)
    }
    section.addEventListener('pointerdown', handleTap)
    return () => {
      section.removeEventListener('pointerdown', handleTap)
      resizeObserver.disconnect()
      window.clearTimeout(resizeDebounce)
    }
  }, [sectionRef, cardRef, dotsContainerRef, rippleContainerRef, clipPathRef])
}

