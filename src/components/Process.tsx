const steps = [
  {
    number: '01',
    title: "Let's Talk",
    desc: "A free first conversation about your business, goals, and what you're looking for.",
  },
  {
    number: '02',
    title: 'Planning & Discovery',
    desc: "If we decide to move forward, we'll map out your content, goals, pages, and website needs in more detail. Planning session fees are credited toward the final project cost.",
  },
  {
    number: '03',
    title: 'Design & Content',
    desc: "I'll shape the structure, visuals, and content direction so your website feels clear, personal, and useful.",
  },
  {
    number: '04',
    title: 'Build & Refine',
    desc: "Your website comes to life. We'll review it together and make thoughtful adjustments before launch.",
  },
  {
    number: '05',
    title: 'Launch',
    desc: 'Once everything is ready, your website goes live and is ready to share.',
  },
]

export default function Process() {
  return (
    <section id="process" className="process">
      <div className="process-inner">
        <div className="process-header">
          <p className="section-label">How It Works</p>
          <h2 className="section-title">My Process</h2>
          <p className="section-subtitle">
            Simple, collaborative, and low-stress from start to finish.
          </p>
        </div>
        <div className="process-steps">
          {steps.map((s) => (
            <div key={s.number} className="process-step">
              <div className="process-number">{s.number}</div>
              <h3 className="process-title">{s.title}</h3>
              <p className="process-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
