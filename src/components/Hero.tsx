export default function Hero() {
  return (
    <section id="hero" className="hero">
      <div className="hero-inner hero-inner--centered">
        <div className="hero-text">
          <p className="hero-eyebrow">A Website That Feels Like You</p>
          <h1 className="hero-headline">
            A thoughtful online home for your business.
          </h1>
          <p className="hero-copy">
            I make professional websites for small businesses, service
            providers, nonprofits, creators, and women-owned businesses —
            without the agency maze, tech-speak, or mystery. Just one real
            person, good communication, and a website you'll feel proud to
            share.
          </p>
          <div className="hero-ctas">
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSeUMYjVivELKZfTlj-8fQlVmpnxPR6feRorBNSfarpT6oMSRg/viewform?usp=header"
              className="btn btn-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get a Free Quote
            </a>
            <a href="#work" className="btn btn-outline">
              Explore My Work
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
