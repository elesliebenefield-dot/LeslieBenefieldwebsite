import { useEffect, type RefObject } from 'react'

/** Nudges the ref'd element by a small fraction of the pointer's offset
 *  from the hero's center, on pointer-fine/hover-capable devices only —
 *  touch devices never attach this listener at all, so their dots get
 *  only the slow, always-on CSS ambient drift (see .hero-dot in
 *  index.css), never pointer-driven movement. Respects
 *  prefers-reduced-motion the same way useScrollReveal.ts does: bail out
 *  before attaching anything. Purely decorative — the moved element must
 *  already be aria-hidden and pointer-events:none (see Hero.tsx), so this
 *  never affects text, links, or buttons. */
export function useHeroParallax(sectionRef: RefObject<HTMLElement | null>, dotsRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const section = sectionRef.current
    const dots = dotsRef.current
    if (!section || !dots) return

    let frame = 0

    function handleMove(e: PointerEvent) {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (!section || !dots) return
        const rect = section.getBoundingClientRect()
        const relX = (e.clientX - rect.left) / rect.width - 0.5
        const relY = (e.clientY - rect.top) / rect.height - 0.5
        // Small, deliberately understated — a "gentle" response, not a
        // cursor-tracking effect. Clamped by the tiny multiplier alone.
        const maxShiftPx = 10
        dots.style.transform = `translate(${(relX * maxShiftPx * 2).toFixed(2)}px, ${(relY * maxShiftPx * 2).toFixed(2)}px)`
      })
    }

    function handleLeave() {
      if (!dots) return
      dots.style.transform = 'translate(0px, 0px)'
    }

    section.addEventListener('pointermove', handleMove)
    section.addEventListener('pointerleave', handleLeave)
    return () => {
      section.removeEventListener('pointermove', handleMove)
      section.removeEventListener('pointerleave', handleLeave)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [sectionRef, dotsRef])
}
