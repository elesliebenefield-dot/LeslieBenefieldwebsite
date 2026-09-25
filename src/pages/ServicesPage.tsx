import { useEffect } from 'react'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import Process from '../components/Process'
import beachBg from '../assets/backgrounds/beach-background.jpeg'
import { useScrollReveal } from '../hooks/useScrollReveal'

const GOOGLE_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSeUMYjVivELKZfTlj-8fQlVmpnxPR6feRorBNSfarpT6oMSRg/viewform?usp=header'

const fitGroups = [
  {
    title: 'Local & professional services',
    desc: 'Clinics, wellness practices, home-service businesses, real estate professionals, notaries, security companies, and consultants.',
  },
  {
    title: 'Food, retail & local business',
    desc: 'Bakeries, food trucks, boutiques, salons, small retail businesses, makers, artists, and locally owned shops.',
  },
  {
    title: 'Personal, creative & community work',
    desc: 'Tattoo artists, massage therapists, photographers, creators, pet sitters, nonprofits, veterans, and community organizations.',
  },
]

const pricingItems = [
  {
    title: 'Free Website Review',
    price: 'Complimentary',
    desc: 'A practical review of your current website to see what\'s working, what could be improved, and whether it\'s good to go as is. If I find something I can help fix, I\'ll explain your options.',
  },
  {
    title: 'Starter Website',
    price: 'Starting at $500',
    desc: 'One page covering your business, services, and contact details, customized using my established design approach. You supply photos and basic information. Includes a mobile-friendly layout, basic search setup, contact links, one revision round, and launch assistance.',
  },
  {
    title: 'Small-Business Website',
    price: 'Custom quote',
    desc: 'A custom multi-page website built around your business, services, and contact needs.',
  },
  {
    title: 'Website Refresh',
    price: 'Custom quote',
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
                Every business is different, so most projects are quoted based on their goals,
                content, and website needs. The Starter Website has a clear starting price for a
                defined scope — and there's no surprise hourly billing.
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

            <p className="services-support" data-reveal>
              <strong>About the Starter Website price</strong> — $500 is the starting price
              for the defined starter scope above. Extra pages, extensive copywriting, custom
              tools, and additional functionality are quoted separately.
            </p>

            <p className="services-support" data-reveal>
              <strong>How website costs work</strong> — Website projects have a one-time build
              fee. No ongoing maintenance plan is required. Domain registration is paid
              separately, and any website hosting costs will be specified in your quote before
              work begins. If you need updates or help later, those are quoted separately.
            </p>

            <p className="services-support" data-reveal>
              <strong>Helpful setup support</strong> — Depending on the project,
              I can also help with domain setup, hosting/deployment, contact forms,
              Google Forms, basic SEO, social preview images, mobile-friendly layout,
              email/phone/social links, website cleanup, polish, and small updates.
            </p>
          </div>
        </section>

        <section className="pricing-tools">
          <div className="pricing-tools-inner" data-reveal>
            <p className="section-label">Add-On Services</p>
            <h2 className="section-title">Interactive Tool Pricing</h2>
            <p className="section-subtitle">
              These are standalone prices for customizing my existing tools for your business,
              hosted for you and ready to share or link from your website. New custom tools and
              automation are quoted individually.
            </p>
            <div className="pricing-tools-groups">
              <div className="pricing-tools-group">
                <h3 className="pricing-tools-group-heading">Tool Setup</h3>
                <ul className="pricing-tools-list">
                  <li>
                    <span className="pricing-tools-item">Individual existing tool, customized (per tool)</span>
                    <span className="pricing-tools-price">Starting at $150</span>
                  </li>
                  <li>
                    <span className="pricing-tools-item">Suite of tools</span>
                    <span className="pricing-tools-price">Custom quote</span>
                  </li>
                  <li>
                    <span className="pricing-tools-item">New custom tools or automation</span>
                    <span className="pricing-tools-price">Custom quote</span>
                  </li>
                </ul>
                <p className="pricing-tools-note">
                  Final setup depends on the customization you request. Suites of tools are
                  quoted as a bundle, with savings compared with setting up the included tools
                  individually. I customize and host the tool, then provide a professional link
                  that your current website provider can add as a button or menu item. Changes
                  to your existing website are not included. Direct integration may be quoted
                  separately when available.
                </p>
              </div>
              <div className="pricing-tools-group">
                <h3 className="pricing-tools-group-heading">Tool Hosting</h3>
                <ul className="pricing-tools-list">
                  <li>
                    <span className="pricing-tools-item">Per business</span>
                    <span className="pricing-tools-price">$10/month</span>
                  </li>
                </ul>
                <p className="pricing-tools-note">
                  One monthly fee per business covers hosting for the tools you've purchased
                  from me, whether that's one tool or several. It isn't charged per tool
                  and doesn't provide access to every tool I offer. This fee covers hosting
                  only; later changes are quoted separately.
                </p>
              </div>
              <div className="pricing-tools-group">
                <h3 className="pricing-tools-group-heading">Adding a tool to your new website?</h3>
                <p className="pricing-tools-note">
                  Discounted tool setup is available when included in a new Websites by Leslie
                  website project and agreed on before the build is completed. Your quote will
                  show the combined price and any Tool Hosting fee. Tools requested after the
                  website is completed are quoted separately.
                </p>
              </div>
            </div>

            <div className="pricing-clarity">
              <h3 className="pricing-clarity-heading">What your tool pricing includes</h3>
              <div className="pricing-clarity-grid">
                <p className="pricing-clarity-item">
                  Tool setup covers your branding, contact details, modest wording and question
                  changes, testing, and one revision round.
                </p>
                <p className="pricing-clarity-item">
                  For customers with an existing website, I provide a hosted tool link for
                  your website provider to add. Editing or directly integrating with an
                  existing website is not included unless quoted separately.
                </p>
                <p className="pricing-clarity-item">
                  Tool Hosting keeps the tools you've purchased online. It is hosting only and
                  does not include content updates, new features, or ongoing support — any later
                  changes are quoted separately.
                </p>
                <p className="pricing-clarity-item">
                  New functionality, major workflow changes, additional revision rounds,
                  payment processing, customer accounts or databases, live scheduling, ordering
                  or inventory systems, and third-party integrations are quoted separately. Paid
                  integrations, automated messaging, or substantial usage that would require
                  additional charges will be discussed and agreed on before those charges apply.
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

        <Process />

        <section id="who-i-work-with" className="pricing-payment">
          <div className="pricing-payment-inner" data-reveal>
            <p className="section-label">Who I Love to Work With</p>
            <h2 className="section-title">A great fit for</h2>
            <p className="section-subtitle">
              Small businesses, service businesses, and community-focused people who need a
              first website, a refresh, or a clearer online presence.
            </p>
            <div className="fit-groups">
              {fitGroups.map((group) => (
                <div className="fit-group" key={group.title}>
                  <h3 className="fit-group-title">{group.title}</h3>
                  <p className="fit-group-desc">{group.desc}</p>
                </div>
              ))}
            </div>
            <p className="section-subtitle">
              Today, I work directly with small businesses, service
              providers, nonprofits, creators, and women-owned businesses
              that need a website for the first time or a better version of
              the one they have. My goal is to help your business look
              credible, easy to understand, and ready for the customers you
              want to reach.
            </p>
            <p className="section-subtitle">
              I'm especially glad to work with veterans, nonprofits,
              women-owned businesses, and people building something
              meaningful in their communities. And because small businesses
              do not always have agency-sized budgets, I'm open to discussing
              practical options — including bartering services when it makes
              sense for both of us.
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
                    contacting the business. Produces an order brief the customer can send from
                    their own email app.
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
                    produces a plain-text brief the client can copy, print, or share.
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
              <h3 className="pricing-free-card-title">Free Bakery Pricing Calculator</h3>
              <p className="pricing-free-card-desc">
                A free, complete cost-and-pricing calculator for bakers and bakery businesses —
                ingredients, labor, packaging, waste, and overhead, with a clear suggested price.
                No account, no ads, and your data stays on your device.
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
