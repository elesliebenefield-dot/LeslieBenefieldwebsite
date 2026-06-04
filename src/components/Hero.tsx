import lesliePhoto from '../assets/portfolio/leslie.jpeg'

export default function Hero() {
  return (
    <section id="hero" className="hero">
      <div className="hero-inner">
        <div className="hero-text">
          <p className="hero-eyebrow">Website Designer & Developer</p>
          <h1 className="hero-name">Leslie Benefield</h1>
          <p className="hero-tagline">Websites for Small Businesses</p>
          <p className="hero-copy">
            I build thoughtful, mobile-friendly websites for small businesses,
            creators, and service providers who need something clear, useful,
            and genuinely theirs.
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
