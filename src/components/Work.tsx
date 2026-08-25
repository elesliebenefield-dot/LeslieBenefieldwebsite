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
    focusReveal: true,
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

function DemoThumb() {
  const panels = [
    {
      accent: 'teal',
      label: 'Bakery',
      sub: 'Custom orders',
      activeStep: 0,
      icon: (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          {/* Flame */}
          <ellipse cx="14" cy="4" rx="1.5" ry="2" fill="#E4BDC6" />
          {/* Candle */}
          <rect x="13" y="5" width="2" height="3" rx="0.5" fill="#CDDFE2" />
          {/* Top tier */}
          <rect x="9" y="8" width="10" height="4" rx="1.5" fill="#1F3347" />
          {/* Middle tier */}
          <rect x="6" y="12" width="16" height="5" rx="2" fill="#4DA3A8" />
          {/* Bottom tier */}
          <rect x="3" y="17" width="22" height="6" rx="2.5" fill="#E4BDC6" />
        </svg>
      ),
    },
    {
      accent: 'blush',
      label: 'Plumbing',
      sub: 'Service visits',
      activeStep: 1,
      icon: (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          {/* Water drop */}
          <path
            d="M14 3C14 3 7.5 13 7.5 18C7.5 21.6 10.4 24.5 14 24.5C17.6 24.5 20.5 21.6 20.5 18C20.5 13 14 3 14 3Z"
            fill="#4DA3A8"
          />
          {/* Highlight */}
          <ellipse cx="11.5" cy="18" rx="2" ry="2.5" fill="white" fillOpacity="0.3" />
        </svg>
      ),
    },
    {
      accent: 'blush',
      label: 'Food Truck',
      sub: 'Event bookings',
      activeStep: 0,
      icon: (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          {/* Truck body */}
          <rect x="1" y="9" width="17" height="12" rx="2" fill="#1F3347" />
          {/* Cab */}
          <rect x="17" y="12" width="9" height="9" rx="2" fill="#4DA3A8" />
          {/* Windshield */}
          <rect x="18" y="13" width="7" height="5" rx="1" fill="#EEF5F5" />
          {/* Serving window */}
          <rect x="3" y="12" width="7" height="4" rx="1" fill="#EEF5F5" />
          {/* Rear wheel */}
          <circle cx="6" cy="23" r="3" fill="#5D7385" />
          {/* Front wheel */}
          <circle cx="21" cy="23" r="3" fill="#5D7385" />
        </svg>
      ),
    },
    {
      accent: 'teal',
      label: 'Real Estate',
      sub: 'Six-tool suite',
      activeStep: 2,
      icon: (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          {/* Roof */}
          <polygon points="2,15 14,3 26,15" fill="#E4BDC6" />
          {/* Walls */}
          <rect x="4" y="14" width="20" height="12" rx="1" fill="#1F3347" />
          {/* Door */}
          <rect x="11" y="19" width="6" height="7" rx="1" fill="#4DA3A8" />
          {/* Left window */}
          <rect x="5.5" y="17" width="4" height="3.5" rx="0.5" fill="#EEF5F5" fillOpacity="0.7" />
          {/* Right window */}
          <rect x="18.5" y="17" width="4" height="3.5" rx="0.5" fill="#EEF5F5" fillOpacity="0.7" />
        </svg>
      ),
    },
  ] as const

  return (
    <div className="demo-thumb">
      {panels.map((panel) => (
        <div key={panel.label} className={`demo-thumb-panel demo-thumb-panel--${panel.accent}`}>
          <div className="demo-thumb-icon">{panel.icon}</div>
          <span className="demo-thumb-label">{panel.label}</span>
          <span className="demo-thumb-sub">{panel.sub}</span>
          <div className="demo-thumb-steps">
            {([0, 1, 2] as const).map((i) => (
              <span
                key={i}
                className={`demo-thumb-step${i === panel.activeStep ? ' demo-thumb-step--active' : ''}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

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
                      className={
                        p.focusReveal
                          ? 'work-card-thumb-img work-card-thumb-img--focus-reveal'
                          : 'work-card-thumb-img'
                      }
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

          {/* Interactive tool demos — featured card linking to the Services page showcase. */}
          <div
            className="work-card"
            data-reveal="premium"
            data-reveal-delay={4}
          >
            <div className="work-card-thumb" aria-hidden="true">
              <DemoThumb />
            </div>
            <div className="work-card-body">
              <span className="work-card-status">Live Demos</span>
              <h3 className="work-card-title">Interactive Tools for Small Businesses</h3>
              <p className="work-card-desc">
                Explore guided web experiences created for bakeries, plumbing companies, food
                trucks, and real estate professionals. Each example helps customers organize
                what they need before contacting the business.
              </p>
              <a
                href="/services#interactive-tool-demos"
                className="work-card-link"
              >
                Explore the Demos
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
