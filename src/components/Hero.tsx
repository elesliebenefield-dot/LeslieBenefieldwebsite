import lesliePhoto from '../assets/portfolio/leslie.jpeg'

export default function Hero() {
  return (
    <section id="hero" className="hero">
      <div className="hero-inner">
        <div className="hero-text">
          <p className="hero-eyebrow">Website Designer & Developer</p>
          <h1 className="hero-headline">
            Helping small businesses look as good online as they are in real life.
          </h1>
          <p className="hero-copy">
            Mobile-friendly websites for small businesses, creators, and service
            providers — built to be clear, useful, and genuinely yours.
          </p>
          <div className="hero-buttons">
            <a href="#work" className="btn btn-primary">View Work</a>
            <a href="#contact" className="btn btn-outline">Contact Me</a>
          </div>
        </div>
        <div className="hero-photo">
          <img
            src={lesliePhoto}
            alt="Leslie Benefield"
            className="hero-photo-img"
          />
        </div>
      </div>
    </section>
  )
}
