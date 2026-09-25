import lesliePhoto from '../assets/portfolio/leslie.jpeg'

export default function About() {
  return (
    <section id="about" className="about">
      <div className="about-inner">
        <div className="about-photo" data-reveal="side-left">
          <img
            src={lesliePhoto}
            alt="Leslie Benefield"
            className="about-photo-img"
          />
        </div>
        <div className="about-content">
          <div className="about-body" data-reveal="side-right">
            <p className="section-label">About</p>
            <h2 className="section-title">Hi, I'm Leslie.</h2>
            <p>
              I didn't come to web design through a typical agency path.
              Before starting Websites by Leslie, I spent more than a decade
              in private security and loss-prevention leadership, along with
              years in customer service, hospitality, logistics, and retail.
              That work taught me how quickly people decide whether they
              trust a business.
            </p>
            <p>
              I started learning website design because I wanted to build
              something of my own. With a little guidance from a friend, it
              grew into a skill set I kept developing — and a business built
              to help other small-business owners feel more confident online.
            </p>
          </div>
          <div className="about-card" data-reveal data-reveal-delay="2">
            <p className="about-card-label">Real-world perspective</p>
            <ul className="about-card-list">
              <li>Nearly 30 years of professional experience</li>
              <li>10+ years in leadership and management</li>
              <li>Creator of MosaicTessera, available on Google Play</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
