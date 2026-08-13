import { useRef } from 'react'
import { useHeroDots } from '../hooks/useHeroDots'

const DOT_COUNT = 14
const LINE_POOL_SIZE = 3

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const dotsRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  useHeroDots(sectionRef, cardRef, dotsRef, svgRef)

  return (
    <section id="hero" className="hero" ref={sectionRef}>
      <div className="hero-dots" aria-hidden="true" ref={dotsRef}>
        {Array.from({ length: DOT_COUNT }, (_, i) => (
          <span key={i} className="hero-dot" />
        ))}
      </div>
      <svg className="hero-dot-lines" aria-hidden="true" ref={svgRef}>
        {Array.from({ length: LINE_POOL_SIZE }, (_, i) => (
          <line key={i} opacity="0" />
        ))}
      </svg>
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
