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
              I didn't come to web design through a typical agency path — and
              I think that's part of what makes my approach different.
            </p>
            <p>
              Before starting Websites by Leslie, I spent more than a decade
              in private security and loss-prevention leadership, along with
              years in customer service, hospitality, logistics, and retail.
              Those experiences taught me how quickly people decide whether
              they trust a business, and how much clear communication and a
              professional first impression matter.
            </p>
            <p>
              I started learning website design because I wanted to build
              something of my own. What began with a little guidance from a
              friend became a skill set I kept developing — and a business
              built to help other small-business owners feel more confident
              online.
            </p>
            <p>
              Today, I work directly with small businesses, service
              providers, nonprofits, creators, and women-owned businesses
              that need a website for the first time or a better version of
              the one they have. My goal is to help your business look
              credible, easy to understand, and ready for the customers you
              want to reach.
            </p>
            <p>
              I'm especially glad to work with veterans, nonprofits,
              women-owned businesses, and people building something
              meaningful in their communities. And because small businesses
              do not always have agency-sized budgets, I'm open to discussing
              practical options — including bartering services when it makes
              sense for both of us.
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
