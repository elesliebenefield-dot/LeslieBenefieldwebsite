const projects = [
  {
    monogram: 'MT',
    status: 'Live on Google Play',
    title: 'MosaicTessera',
    desc: 'A private health and life journaling app designed to help people organize symptoms, medications, appointments, health records, and personal wellness information.',
    url: 'https://play.google.com/store/apps/details?id=com.mosaictessera.app',
    buttonText: 'View on Google Play',
  },
  {
    monogram: 'APC',
    status: 'Portfolio Preview',
    title: "Ashley's Pet Care",
    desc: 'A custom website for a local pet care business focused on building trust, showcasing services, and making it easy for clients to get in touch.',
    url: 'https://ashleys-pet-care.vercel.app',
    buttonText: 'View Preview',
  },
  {
    monogram: 'SSE',
    status: 'Portfolio Preview',
    title: "Sissy's Sweets by EM",
    desc: 'A custom bakery website designed to showcase products, highlight customer reviews, and make ordering simple and approachable.',
    url: 'https://sissyssweetsbyem.vercel.app',
    buttonText: 'View Preview',
  },
]

export default function Work() {
  return (
    <section id="work" className="work">
      <div className="work-inner">
        <div className="work-header">
          <p className="section-label">My Work</p>
          <h2 className="section-title">Projects</h2>
          <p className="section-subtitle">
            Real projects I've built, launched, or actively developed.
          </p>
        </div>
        <div className="work-grid">
          {projects.map((p) => (
            <div key={p.title} className="work-card">
              <div className="work-card-thumb">
                <span className="work-card-monogram">{p.monogram}</span>
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
