const services = [
  {
    icon: '🌐',
    title: 'Simple Websites',
    desc: 'Clean, fast, mobile-ready websites built from scratch for small businesses and individuals.',
  },
  {
    icon: '✏️',
    title: 'Website Refreshes',
    desc: 'Update an existing site to feel modern, load faster, and better represent who you are today.',
  },
  {
    icon: '📄',
    title: 'Landing Pages',
    desc: 'Focused, conversion-friendly landing pages that clearly communicate your offer.',
  },
  {
    icon: '🗂️',
    title: 'Portfolio & Personal Sites',
    desc: 'Custom sites that help creatives and professionals show their work and tell their story.',
  },
  {
    icon: '📱',
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
              data-reveal="soft"
              data-reveal-delay={i + 1}
            >
              <div className="service-icon">{s.icon}</div>
              <h3 className="service-title">{s.title}</h3>
              <p className="service-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
