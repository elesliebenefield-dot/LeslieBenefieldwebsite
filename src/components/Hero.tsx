import lesliePhoto from '../assets/portfolio/leslie.jpeg'

export default function Hero() {
  return (
    <section id="hero" className="hero">
      <div className="hero-inner">
        <div className="hero-text">
          <p className="hero-eyebrow">Website Designer & Developer</p>
          <h1 className="hero-headline">Websites with personality.</h1>
          <p className="hero-copy">
            Custom websites for small businesses, creators, and service providers.
          </p>
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
