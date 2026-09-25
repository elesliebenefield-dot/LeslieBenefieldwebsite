import { useRef } from 'react'
import { useHeroDots } from '../hooks/useHeroDots'

const DOT_COUNT = 12

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  // Points at .hero-cards (the wrapper around the hero card), not the card
  // itself — so the clip-path hole useHeroDots.ts cuts always matches the
  // whole card composition, guaranteeing ripples/dots stay behind it.
  const cardsRef = useRef<HTMLDivElement>(null)
  const dotsRef = useRef<HTMLDivElement>(null)
  const rippleRef = useRef<HTMLDivElement>(null)
  const clipPathRef = useRef<SVGPathElement>(null)
  useHeroDots(sectionRef, cardsRef, dotsRef, rippleRef, clipPathRef)

  return (
    <section id="hero" className="hero" ref={sectionRef}>
      {/* Zero-size — exists only to define the clip-path referenced by
          .hero-fx below. That clip-path is what guarantees dots/ripples
          can never be seen over the card: it cuts a hole exactly matching
          .hero-cards' live measured rect, kept in sync by useHeroDots.ts. */}
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <defs>
          <clipPath id="heroCardHole" clipPathUnits="userSpaceOnUse">
            <path ref={clipPathRef} fillRule="evenodd" />
          </clipPath>
        </defs>
      </svg>
      <div className="hero-fx" aria-hidden="true">
        <div className="hero-dots" ref={dotsRef}>
          {Array.from({ length: DOT_COUNT }, (_, i) => (
            <span key={i} className="hero-dot" />
          ))}
        </div>
        <div className="hero-ripples" ref={rippleRef} />
      </div>
      <div className="hero-inner hero-inner--centered">
        <div className="hero-cards" ref={cardsRef}>
          <div className="hero-text">
            <p className="hero-eyebrow">Hi, I'm Leslie.</p>
            <h1 className="hero-headline">
              Websites, custom tools, and automation for small businesses.
            </h1>
            <p className="hero-copy">
              I build clear, mobile-friendly websites and practical tools that
              help customers reach you and take busywork off your plate.
            </p>
            <div className="hero-ctas">
              <a href="#work" className="btn btn-primary">
                See My Work
              </a>
              <a href="/business-tools" className="btn btn-outline">
                Explore Business Tools
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
