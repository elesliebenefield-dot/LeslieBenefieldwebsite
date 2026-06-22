import lesliePhoto from '../assets/portfolio/leslie.jpeg'

export default function About() {
  return (
    <section id="about" className="about">
      <div className="about-inner">
        <div className="about-photo" data-reveal>
          <img
            src={lesliePhoto}
            alt="Leslie Benefield"
            className="about-photo-img"
          />
        </div>
        <div className="about-content">
          <div className="about-body" data-reveal>
            <p className="section-label">About</p>
            <h2 className="section-title">Hi, I'm Leslie.</h2>
            <p>
              I'm an independent local developer who builds websites for small
              businesses, creators, and service providers. I got into web
              development because I enjoy helping people — and I saw how many
              small business owners were struggling to get online.
            </p>
            <p>
              Before learning web and app development, I spent nearly 30 years
              working with people, customers, teams, and businesses in the real
              world. That experience shapes how I approach every project today —
              with clear communication and a focus on what actually matters for
              your business.
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
