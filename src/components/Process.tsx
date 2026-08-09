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
        <div className="process-header" data-reveal>
          <p className="section-label">How It Works</p>
          <h2 className="section-title">My Process</h2>
          <p className="section-subtitle">
            Simple, collaborative, and low-stress from start to finish.
          </p>
        </div>
        <div className="process-steps">
          {steps.map((s, i) => (
            <div
              key={s.number}
              className="process-step"
              data-num={s.number}
              data-reveal="soft"
              data-reveal-delay={i + 1}
            >
              <div className="process-number">{s.number}</div>
              {/* h2, not h3: each .process-step card reveals independently of
                  the "My Process" h2 above (separate data-reveal wrapper), so
                  a step title can be visible while that h2 isn't — with h3 that
                  produced an h1->h3 skip in the visible heading sequence on
                  mobile. Same level as the section's own h2 keeps the visible
                  sequence valid regardless of which cards have revealed.
                  className="process-title" is styled purely by class, not
                  tag, so this is a structural-only change (see index.css). */}
              <h2 className="process-title">{s.title}</h2>
              <p className="process-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
