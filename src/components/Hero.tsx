export default function Hero() {
  return (
    <section id="hero" className="hero">
      <div className="hero-inner hero-inner--split">
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
        <div className="hero-visual" aria-hidden="true">
          <span className="hero-visual-shape hero-visual-shape--one" />
          <span className="hero-visual-shape hero-visual-shape--two" />
          <span className="hero-visual-shape hero-visual-shape--three" />
        </div>
      </div>
    </section>
  )
}
