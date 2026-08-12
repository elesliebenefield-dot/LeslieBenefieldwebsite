import { useRef } from 'react'
import { useHeroParallax } from '../hooks/useHeroParallax'

const DOT_COUNT = 10

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const dotsRef = useRef<HTMLDivElement>(null)
  useHeroParallax(sectionRef, dotsRef)

  return (
    <section id="hero" className="hero" ref={sectionRef}>
      <div className="hero-dots" aria-hidden="true" ref={dotsRef}>
        {Array.from({ length: DOT_COUNT }, (_, i) => (
          <span key={i} className={`hero-dot hero-dot--${i + 1}`} />
        ))}
      </div>
      <div className="hero-inner hero-inner--centered">
        <div className="hero-text">
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
