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

export default function Tools() {
  return (
    <section id="tools" className="tools-band">
      <div className="tools-band-inner" data-reveal>
        <div className="tools-band-thumb" aria-hidden="true">
          <DemoThumb />
        </div>
        <div className="tools-band-body">
          <p className="section-label">Business Tools</p>
          <h2 className="section-title">Try a tool for yourself.</h2>
          <div className="tools-callout">
            <span className="tools-callout-eyebrow">Free tool &amp; live demos</span>
            <p className="tools-callout-text">
              A free pricing calculator for bakers and bakery businesses, plus live demos for bakery, plumbing, food truck, and real estate businesses—each one can be customized for yours.{' '}
              <a href="/business-tools" className="tools-callout-link">Browse all tools →</a>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
