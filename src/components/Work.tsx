import type { ReactNode } from 'react'
import ashleysImg from '../assets/portfolio/ashleys-pet-care.jpeg'
import sissysImg from '../assets/portfolio/sissys-sweets-2026.jpeg'
import mosaicImg from '../assets/portfolio/mosaic-tessera-icon.jpeg'

const projects = [
  {
    img: ashleysImg,
    imgAlt: "Ashley's Pet Care website screenshot",
    isIcon: false,
    thumbPosition: 'center 18%',
    status: 'Client Project',
    title: "Ashley's Pet Care",
    desc: 'A custom website for a local pet care business focused on building trust, showcasing services, and making it easy for clients to get in touch.',
    url: 'https://ashleys-pet-care.vercel.app',
    buttonText: 'View Preview',
  },
  {
    img: sissysImg,
    imgAlt: "Sissy's Sweets by EM website screenshot",
    isIcon: false,
    thumbPosition: 'center 6%',
    status: 'Live Website',
    title: "Sissy's Sweets by EM",
    desc: 'A custom bakery website designed to showcase products, highlight customer reviews, and make ordering simple and approachable.',
    url: 'https://sissyssweets-byem.com',
    buttonText: 'Visit Website',
  },
  {
    img: mosaicImg,
    imgAlt: 'MosaicTessera app icon',
    isIcon: true,
    thumbPosition: 'center',
    status: 'Live on Google Play',
    title: 'MosaicTessera',
    desc: 'A private health and life journaling app designed to help people organize symptoms, medications, appointments, and personal wellness information.',
    url: 'https://play.google.com/store/apps/details?id=com.mosaictessera.app',
    buttonText: 'View on Google Play',
  },
]

function BrowserChrome({ children }: { children: ReactNode }) {
  return (
    <div className="browser-mockup">
      <div className="browser-bar" aria-hidden="true">
        <div className="browser-bar-dots">
          <span className="browser-bar-dot" />
          <span className="browser-bar-dot" />
          <span className="browser-bar-dot" />
        </div>
        <div className="browser-bar-url" />
      </div>
      <div className="browser-screen">{children}</div>
    </div>
  )
}

export default function Work() {
  return (
    <section id="work" className="work">
      <div className="work-inner">
        <div className="work-header" data-reveal>
          <p className="section-label">Portfolio</p>
          <h2 className="section-title">Recent Projects</h2>
          <p className="section-subtitle">
            Real projects I've built, launched, or actively developed.
          </p>
        </div>
        <div className="work-grid">
          {projects.map((p, i) => (
            <div
              key={p.title}
              className="work-card"
              data-reveal="premium"
              data-reveal-delay={i + 1}
            >
              <div className="work-card-thumb">
                {p.isIcon ? (
                  <img
                    src={p.img}
                    alt={p.imgAlt}
                    className="work-card-thumb-img work-card-thumb-img--icon"
                  />
                ) : (
                  <BrowserChrome>
                    <img
                      src={p.img}
                      alt={p.imgAlt}
                      className="work-card-thumb-img"
                      style={{ objectPosition: p.thumbPosition }}
                    />
                  </BrowserChrome>
                )}
              </div>
              <div className="work-card-body">
                <span className="work-card-status">{p.status}</span>
                <h3 className="work-card-title">{p.title}</h3>
                <p className="work-card-desc">{p.desc}</p>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="work-card-link"
                >
                  {p.buttonText}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
