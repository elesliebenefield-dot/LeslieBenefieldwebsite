export default function Hero() {
  return (
    <section id="hero" className="hero">
      <div className="hero-inner hero-inner--centered">
        <div className="hero-text">
          <p className="hero-eyebrow">Independent Web Designer</p>
          <h1 className="hero-headline">
            Good websites don't have to come from a big agency.
          </h1>
          <p className="hero-copy">
            I design and build every site personally — working directly with
            you from first conversation to launch. Simple process, no jargon,
            no hand-offs. Just careful work for small businesses that want a
            website they're actually proud of.
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
