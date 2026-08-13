import { useRef } from 'react'
import { useHeroDots } from '../hooks/useHeroDots'

const DOT_COUNT = 12

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const dotsRef = useRef<HTMLDivElement>(null)
  const rippleRef = useRef<HTMLDivElement>(null)
  const clipPathRef = useRef<SVGPathElement>(null)
  useHeroDots(sectionRef, cardRef, dotsRef, rippleRef, clipPathRef)

  return (
    <section id="hero" className="hero" ref={sectionRef}>
      {/* Zero-size — exists only to define the clip-path referenced by
          .hero-fx below. That clip-path is what guarantees dots/ripples
          can never be seen over the card: it cuts a hole exactly matching
          the card's live measured rect, kept in sync by useHeroDots.ts. */}
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
        <div className="hero-text" ref={cardRef}>
          <p className="hero-eyebrow">Hi, I'm Leslie.</p>
          <h1 className="hero-headline">
            I help small businesses create a website that feels clear,
            trustworthy, and like them.
          </h1>
          <p className="hero-copy">
            I work directly with small businesses, service providers,
            nonprofits, creators, and women-owned businesses. No confusing
            tech language — just thoughtful design, clear communication, and
            a website you'll feel good sharing.
          </p>
          <p className="hero-fit">
            <span className="hero-fit-label">A great fit for:</span> clinics,
            bakeries, pet sitters, home-service businesses, real estate
            professionals, security companies, tattoo artists, food trucks,
            notaries, massage therapists, makers, and creators.
          </p>
          <div className="hero-ctas">
            <a href="#work" className="btn btn-primary">
              See My Work
            </a>
            <a href="/check" className="btn btn-outline">
              Request a Free Website Review
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
