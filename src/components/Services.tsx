const GOOGLE_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSeUMYjVivELKZfTlj-8fQlVmpnxPR6feRorBNSfarpT6oMSRg/viewform?usp=header'

const GlobeIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
)

const LayoutGridIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/>
    <rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/>
  </svg>
)

const RefreshIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
)

const services = [
  {
    icon: <GlobeIcon />,
    title: 'Websites',
    desc: 'Clean, fast, mobile-ready websites built from scratch — plus refreshes, landing pages, and portfolio sites.',
    link: { label: 'Services & pricing →', href: '/services', external: false },
  },
  {
    icon: <LayoutGridIcon />,
    title: 'Custom Business Tools',
    desc: 'Interactive, app-like tools — from order planners to intake forms — built around how your business works.',
    link: { label: 'See examples →', href: '#tools', external: false },
  },
  {
    icon: <RefreshIcon />,
    title: 'Automation',
    desc: 'Custom workflows and simple automations that reduce repetitive business tasks.',
    link: { label: 'Get a quote →', href: GOOGLE_FORM_URL, external: true },
  },
]

export default function Services() {
  return (
    <section id="services" className="services">
      <div className="services-inner">
        <div className="services-header" data-reveal>
          <p className="section-label">What I Do</p>
          <h2 className="section-title">What I Build</h2>
        </div>
        <div className="services-grid">
          {services.map((s, i) => (
            <div
              key={s.title}
              className="service-card"
              data-num={String(i + 1).padStart(2, '0')}
              data-reveal="soft"
              data-reveal-delay={i + 1}
            >
              <div className="service-icon">{s.icon}</div>
              <h3 className="service-title">{s.title}</h3>
              <p className="service-desc">{s.desc}</p>
              <a
                href={s.link.href}
                className="service-link"
                {...(s.link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {s.link.label}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
