const GlobeIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
)

const EditIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
)

const FileTextIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <line x1="10" y1="9" x2="8" y2="9"/>
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

const SmartphoneIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
    <line x1="12" y1="18" x2="12.01" y2="18"/>
  </svg>
)

const services = [
  {
    icon: <GlobeIcon />,
    title: 'Simple Websites',
    desc: 'Clean, fast, mobile-ready websites built from scratch for small businesses and individuals.',
  },
  {
    icon: <EditIcon />,
    title: 'Website Refreshes',
    desc: 'Update an existing site to feel modern, load faster, and better represent who you are today.',
  },
  {
    icon: <FileTextIcon />,
    title: 'Landing Pages',
    desc: 'Focused, conversion-friendly landing pages that clearly communicate your offer.',
  },
  {
    icon: <LayoutGridIcon />,
    title: 'Portfolio & Personal Sites',
    desc: 'Custom sites that help creatives and professionals show their work and tell their story.',
  },
  {
    icon: <SmartphoneIcon />,
    title: 'App-Style Web Experiences',
    desc: 'Interactive, app-like web projects — from booking flows to simple tools and dashboards.',
  },
]

export default function Services() {
  return (
    <section id="services" className="services">
      <div className="services-inner">
        <div className="services-header" data-reveal>
          <p className="section-label">What I Do</p>
          <h2 className="section-title">Services</h2>
          <p className="section-subtitle">
            I specialize in websites for small businesses and service providers —
            clean, mobile-ready, and built to last.
          </p>
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
            </div>
          ))}
        </div>
        <p className="services-support" data-reveal>
          <strong>Helpful setup support</strong> — Depending on the project,
          I can also help with domain setup, hosting/deployment, contact forms,
          Google Forms, basic SEO, social preview images, mobile-friendly layout,
          email/phone/social links, website cleanup, polish, and small updates.
        </p>
      </div>
    </section>
  )
}
