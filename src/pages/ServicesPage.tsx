import { useEffect } from 'react'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import beachBg from '../assets/backgrounds/beach-background.jpeg'
import { useScrollReveal } from '../hooks/useScrollReveal'

const GOOGLE_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSeUMYjVivELKZfTlj-8fQlVmpnxPR6feRorBNSfarpT6oMSRg/viewform?usp=header'

const pricingItems = [
  {
    title: 'Free Website Review',
    price: 'Complimentary',
    desc: 'A practical review of your current website to see what\'s working, what could be improved, and whether it\'s good to go as is. If I find something I can help fix, I\'ll explain your options.',
  },
  {
    title: 'One-Page Website or Landing Page',
    price: 'Starting at $750',
    desc: 'A focused page for a service, event, offer, portfolio, or new business.',
  },
  {
    title: 'Small-Business Website',
    price: 'Starting at $1,500',
    desc: 'A custom multi-page website built around your business, services, and contact needs.',
  },
  {
    title: 'Website Refresh',
    price: 'Starting at $800',
    desc: 'For an existing website that needs a clearer look, updated content, better mobile usability, or general cleanup.',
  },
  {
    title: 'Website Updates & Support',
    price: 'Custom quote',
    desc: 'Small updates, content changes, fixes, and additions are quoted by scope before work begins.',
  },
]

export default function ServicesPage() {
  useScrollReveal()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return
    const el = document.getElementById(hash.slice(1))
    if (!el) return
    // scroll-margin-top: 64px on section[id] already offsets for the sticky nav
    requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'start', behavior: 'instant' })
    })
  }, [])

  return (
    <>
      <div className="site-bg" aria-hidden="true">
        <img src={beachBg} alt="" className="site-bg-img" />
        <div className="site-bg-overlay" />
      </div>
      <Nav variant="page" />
      <main>
        <section className="pricing">
          <div className="pricing-inner">
            <a href="/" className="pricing-back">
              ← Back to Websites by Leslie
            </a>

            <div className="pricing-header" data-reveal>
              <p className="section-label">Services & Pricing</p>
              <h1 className="section-title">Clear options. Custom quotes.</h1>
              <p className="section-subtitle">
                Every business is different, so every project is quoted based on its goals,
                content, and website needs. These starting prices are here to help you
                understand the typical investment before we talk — no surprise hourly billing.
              </p>
            </div>

            <div className="pricing-grid">
              {pricingItems.map((item, i) => (
                <div
                  key={item.title}
                  className="pricing-card"
                  data-num={String(i + 1).padStart(2, '0')}
                  data-reveal="soft"
                  data-reveal-delay={i + 1}
                >
                  <h2 className="pricing-card-title">{item.title}</h2>
                  <p className="pricing-card-price">{item.price}</p>
                  <p className="pricing-card-desc">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pricing-tools">
          <div className="pricing-tools-inner" data-reveal>
            <p className="section-label">Add-On Services</p>
            <h2 className="section-title">Interactive Tool Pricing</h2>
            <p className="section-subtitle">
              Interactive tools can be added to a new Websites by Leslie project or customized
              and hosted for a business that already has a website. Pricing depends on the number
              of tools and whether they are being created as part of a new website project.
            </p>
            <div className="pricing-tools-groups">
              <div className="pricing-tools-group">
                <h3 className="pricing-tools-group-heading">Added to a New Website</h3>
                <ul className="pricing-tools-list">
                  <li>
                    <span className="pricing-tools-item">One tool</span>
                    <span className="pricing-tools-price">Starting at $250</span>
                  </li>
                  <li>
                    <span className="pricing-tools-item">Suite of 2–3 tools</span>
                    <span className="pricing-tools-price">Starting at $600</span>
                  </li>
                  <li>
                    <span className="pricing-tools-item">Complete suite of 4–6 tools</span>
                    <span className="pricing-tools-price">Starting at $1,000</span>
                  </li>
                </ul>
                <p className="pricing-tools-note">
                  These reduced prices are available when the tools are planned, branded, and
                  launched as part of a new Websites by Leslie website project.
                </p>
              </div>
              <div className="pricing-tools-group">
                <h3 className="pricing-tools-group-heading">For an Existing Website</h3>
                <ul className="pricing-tools-list">
                  <li>
                    <span className="pricing-tools-item">One hosted tool</span>
                    <span className="pricing-tools-price">Starting at $400</span>
                  </li>
                  <li>
                    <span className="pricing-tools-item">Suite of 2–3 hosted tools</span>
                    <span className="pricing-tools-price">Starting at $800</span>
                  </li>
                  <li>
                    <span className="pricing-tools-item">Complete suite of 4–6 hosted tools</span>
                    <span className="pricing-tools-price">Starting at $1,500</span>
                  </li>
                </ul>
                <p className="pricing-tools-note">
                  I customize and host the tool, then provide a professional link that your
                  current website provider can add as a button or menu item. Changes to your
                  existing website are not included. Direct integration may be quoted separately
                  when available.
                </p>
              </div>
              <div className="pricing-tools-group">
                <h3 className="pricing-tools-group-heading">Monthly Hosting &amp; Care</h3>
                <ul className="pricing-tools-list">
                  <li>
                    <span className="pricing-tools-item">One tool</span>
                    <span className="pricing-tools-price">Starting at $19/month</span>
                  </li>
                  <li>
                    <span className="pricing-tools-item">Suite of 2–3 tools</span>
                    <span className="pricing-tools-price">Starting at $29/month</span>
                  </li>
                  <li>
                    <span className="pricing-tools-item">Suite of 4–6 tools</span>
                    <span className="pricing-tools-price">Starting at $49/month</span>
                  </li>
                </ul>
                <p className="pricing-tools-note">
                  Hosting and care includes continued tool availability, compatibility
                  maintenance, bug fixes, and small updates to basic business contact
                  information. New tools, redesigned workflows, major content changes, and
                  third-party integrations are quoted separately.
                </p>
              </div>
            </div>

            <div className="pricing-clarity">
              <h3 className="pricing-clarity-heading">What your tool pricing includes</h3>
              <div className="pricing-clarity-grid">
                <p className="pricing-clarity-item">
                  Every tool setup includes your branding, standard question and wording
                  customization, testing, setup and launch, and one revision round.
                </p>
                <p className="pricing-clarity-item">
                  For customers with an existing website, I provide a hosted tool link for
                  your website provider to add. Editing or directly integrating with an
                  existing website is not included unless quoted separately.
                </p>
                <p className="pricing-clarity-item">
                  Monthly Hosting &amp; Care includes continued hosting, compatibility
                  maintenance, bug fixes, and small contact-information updates.
                </p>
                <p className="pricing-clarity-item">
                  Major workflow changes, additional revision rounds, payment processing,
                  customer accounts or databases, live scheduling, ordering or inventory
                  systems, and third-party integrations are quoted separately.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="pricing-payment">
          <div className="pricing-payment-inner" data-reveal>
            <p className="section-label">Payment & Project Terms</p>
            <h2 className="section-title">Simple, clear payment expectations.</h2>
            <p className="section-subtitle">
              A 50% project deposit is due before work begins. The remaining 50% is due after
              the final review is approved and before your website is launched or transferred
              to you. Larger projects may use a custom payment schedule, agreed on in writing
              before work begins. Barter arrangements may be considered on a case-by-case basis.
            </p>
            <p className="section-subtitle">
              Rush projects: if you need a website or update completed on a short timeline, a
              rush fee may apply to reserve dedicated time. Rush availability depends on my
              current schedule, and any additional fee will be clearly included in your written
              quote before work begins.
            </p>
          </div>
        </section>

        <section id="interactive-tool-demos" className="pricing-demo" data-reveal>
          <div className="pricing-demo-inner">
            <p className="section-label">See It in Action</p>
            <h2 className="section-title">Interactive web experiences — built for real businesses.</h2>
            <p className="section-subtitle">
              I build tools and interactive experiences that make it easier for your customers to
              engage with your business before they ever reach out. Here are four live examples:
            </p>
            <div className="pricing-demo-cards">
              <div className="pricing-demo-card">
                <div className="pricing-demo-card-body">
                  <span className="pricing-demo-tag">Live Demo</span>
                  <h3 className="pricing-demo-card-title">Custom Bakery Order Planner</h3>
                  <p className="pricing-demo-card-desc">
                    A guided, step-by-step tool that helps a bakery customer organize their order
                    request — including inscription, colors, size, timing, and questions — before
                    contacting the business. Produces a ready-to-send order brief with one click.
                  </p>
                  <a
                    href="/tools-custom-bakery-order"
                    className="pricing-demo-link"
                  >
                    Try the Demo →
                  </a>
                </div>
              </div>
              <div className="pricing-demo-card">
                <div className="pricing-demo-card-body">
                  <span className="pricing-demo-tag">Live Demo</span>
                  <h3 className="pricing-demo-card-title">Plumbing Service Visit Planner</h3>
                  <p className="pricing-demo-card-desc">
                    A calm, guided form that helps a homeowner organize what they've observed
                    before calling a plumber — including location, timeline, and access details.
                    Produces a plain-text service visit brief they can copy, print, or email.
                  </p>
                  <a
                    href="/tools-plumbing-visit"
                    className="pricing-demo-link"
                  >
                    Try the Demo →
                  </a>
                </div>
              </div>
              <div className="pricing-demo-card">
                <div className="pricing-demo-card-body">
                  <span className="pricing-demo-tag">Live Demo</span>
                  <h3 className="pricing-demo-card-title">Food Truck Event Planner</h3>
                  <p className="pricing-demo-card-desc">
                    A guided form that helps an event organizer prepare a clear service inquiry
                    before reaching out to a mobile food or beverage vendor — covering the event,
                    the food, and the venue logistics.
                  </p>
                  <a
                    href="/tools-food-truck-event"
                    className="pricing-demo-link"
                  >
                    Try the Demo →
                  </a>
                </div>
              </div>
              <div className="pricing-demo-card">
                <div className="pricing-demo-card-body">
                  <span className="pricing-demo-tag">Live Demo</span>
                  <h3 className="pricing-demo-card-title">Real Estate Client Tools</h3>
                  <p className="pricing-demo-card-desc">
                    A connected suite of six interactive planning tools for buyers, sellers, and
                    clients — from the first conversation through closing and moving. Each tool
                    produces a plain-text brief the client can copy, print, or email directly.
                  </p>
                  <a
                    href="/real-estate-tools"
                    className="pricing-demo-link"
                  >
                    Explore the Suite →
                  </a>
                </div>
              </div>
            </div>
            <p className="pricing-demo-note">
              These are examples of app-style web experiences. Similar tools can be built for
              bakeries, plumbing companies, service businesses, custom-order shops, and more.
            </p>
          </div>
        </section>

        <section id="free-tools" className="pricing-free" data-reveal>
          <div className="pricing-free-inner">
            <p className="section-label">Genuinely Free</p>
            <h2 className="section-title">A free tool, not a demo.</h2>
            <p className="section-subtitle">
              Unlike the interactive demos above, the tool below isn't a preview of custom work —
              it's a complete, ready-to-use resource, free for anyone to use.
            </p>
            <div className="pricing-free-card">
              <span className="pricing-free-tag">Free Tool</span>
              <h3 className="pricing-free-card-title">Free Home Bakery Pricing Calculator</h3>
              <p className="pricing-free-card-desc">
                A free, complete cost-and-pricing calculator for home bakers — ingredients, labor,
                packaging, waste, and overhead, with a clear suggested price. No account, no ads,
                and your data stays on your device.
              </p>
              <a href="/bakery-pricing-guide" className="pricing-free-link">
                Use the Free Calculator →
              </a>
            </div>
          </div>
        </section>

        <section className="pricing-cta">
          <div className="pricing-cta-inner" data-reveal>
            <h2 className="section-title">Not sure which option fits?</h2>
            <p className="section-subtitle">
              Request a free website review, and I'll take a personal look at your current
              site to see what's working, what could be improved, and whether it needs any
              changes at all.
            </p>
            <div className="pricing-cta-buttons">
              <a href="/check" className="btn btn-primary">
                Request a Free Website Review
              </a>
              <a
                href={GOOGLE_FORM_URL}
                className="btn btn-outline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Get a Free Quote
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
