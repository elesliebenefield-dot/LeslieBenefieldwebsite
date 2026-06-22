export default function Hero() {
  return (
    <section id="hero" className="hero">
      <div className="hero-inner hero-inner--centered">
        <div className="hero-text">
          <p className="hero-eyebrow">Website Designer & Developer</p>
          <h1 className="hero-headline">
            Helping small businesses get online without the DIY headache.
          </h1>
          <p className="hero-copy">
            Whether you need a brand-new website or you're tired of fighting
            with DIY builders, I'm here to help. I build clean, affordable
            websites from scratch for small businesses that just need things
            to work.
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
              See My Work
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
