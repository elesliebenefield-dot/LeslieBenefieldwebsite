const projects = [
  {
    monogram: 'MT',
    status: 'In Progress',
    title: 'MosaicTessera',
    desc: 'A health journaling app designed to help people notice patterns in how they feel over time. Built with care and intentionality.',
  },
  {
    monogram: 'APC',
    status: 'Portfolio Build',
    title: "Ashley's Pet Care",
    desc: "A local pet care business website — clean, warm, and easy for pet owners to browse services and get in touch.",
  },
  {
    monogram: 'SSE',
    status: 'Portfolio Build',
    title: "Sissy's Sweets by EM",
    desc: 'A small bakery site showcasing handmade treats, with a focus on personality and mobile-friendly browsing.',
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
            A mix of active projects and portfolio builds that show what I'm capable of.
            More coming soon.
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
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
