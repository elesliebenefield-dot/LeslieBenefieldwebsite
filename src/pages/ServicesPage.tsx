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
    desc: 'A personal look at your current website and whether your project may be a good fit for my services.',
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

        <section className="pricing-cta">
          <div className="pricing-cta-inner" data-reveal>
            <h2 className="section-title">Not sure which option fits?</h2>
            <p className="section-subtitle">
              Request a free website review, and I'll take a personal look at your current
              site or idea before we decide on next steps.
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
