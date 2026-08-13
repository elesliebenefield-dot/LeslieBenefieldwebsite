import { useRef } from 'react'
import { useHeroDots } from '../hooks/useHeroDots'

const DOT_COUNT = 12

const fitGroups = [
  {
    title: 'Local & professional services',
    items: [
      'Medical, dental, wellness, and therapy practices',
      'Plumbers, HVAC companies, electricians, cleaners, and other home-service businesses',
      'Real estate professionals, notaries, security companies, and consultants',
    ],
  },
  {
    title: 'Food, retail & local business',
    items: [
      'Bakeries, food trucks, boutiques, salons, and small retail businesses',
      'Makers, artists, and locally owned shops',
    ],
  },
  {
    title: 'Personal, creative & community work',
    items: [
      'Tattoo artists, massage therapists, photographers, and creators',
      'Pet sitters and other care-based services',
      'Nonprofits, veterans, and community organizations',
    ],
  },
]

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  // Points at .hero-cards (the wrapper around BOTH the main card and the
  // companion card below), not just the main card — so the clip-path hole
  // useHeroDots.ts cuts covers the whole two-card composition (including
  // the gap between them), guaranteeing ripples/dots stay behind both.
  const cardsRef = useRef<HTMLDivElement>(null)
  const dotsRef = useRef<HTMLDivElement>(null)
  const rippleRef = useRef<HTMLDivElement>(null)
  const clipPathRef = useRef<SVGPathElement>(null)
  useHeroDots(sectionRef, cardsRef, dotsRef, rippleRef, clipPathRef)

  return (
    <section id="hero" className="hero" ref={sectionRef}>
      {/* Zero-size — exists only to define the clip-path referenced by
          .hero-fx below. That clip-path is what guarantees dots/ripples
          can never be seen over the cards: it cuts a hole exactly matching
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
          <div className="hero-fit-card">
            <p className="hero-eyebrow">Who I Love to Work With</p>
            <h2 className="hero-fit-title">A great fit for</h2>
            <p className="hero-fit-intro">
              Small businesses and community-focused people who need a first
              website, a refresh, or a clearer online presence.
            </p>
            {fitGroups.map((group) => (
              <div className="hero-fit-group" key={group.title}>
                <h3 className="hero-fit-group-title">{group.title}</h3>
                <ul className="hero-fit-list">
                  {group.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
