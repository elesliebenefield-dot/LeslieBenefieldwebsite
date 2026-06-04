const steps = [
  {
    number: '01',
    title: 'Listen',
    desc: 'I start by understanding your goals, your audience, and what success looks like for you.',
  },
  {
    number: '02',
    title: 'Plan',
    desc: 'Together we map out the structure, content, and look-and-feel before anything gets built.',
  },
  {
    number: '03',
    title: 'Build',
    desc: 'I write clean, organized code and bring the design to life — mobile-first, always.',
  },
  {
    number: '04',
    title: 'Review',
    desc: 'You see the work, give feedback, and we refine it together until it feels right.',
  },
  {
    number: '05',
    title: 'Launch',
    desc: "Once you're happy, we get your site live — and I make sure the handoff is smooth.",
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
