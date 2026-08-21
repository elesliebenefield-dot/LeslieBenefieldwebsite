import Nav from '../components/Nav'
import Footer from '../components/Footer'
import beachBg from '../assets/backgrounds/beach-background.jpeg'
import { useScrollReveal } from '../hooks/useScrollReveal'

const GOOGLE_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSeUMYjVivELKZfTlj-8fQlVmpnxPR6feRorBNSfarpT6oMSRg/viewform?usp=header'

// ── Icons ────────────────────────────────────────────────────────────
const IconBuyer = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
    <path d="M9 21V12h6v9" />
  </svg>
)

const IconSeller = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
    <path d="M9 12h6M12 9v6" />
  </svg>
)

const IconListing = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <path d="M9 7h6M9 11h6M9 15h4" />
    <path d="M15.5 15.5l1.5 1.5 2.5-2.5" />
  </svg>
)

const IconCompare = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="9" height="14" rx="1.5" />
    <rect x="13" y="7" width="9" height="14" rx="1.5" />
    <path d="M5 5V3M19 5V3M12 10v4" />
  </svg>
)

const IconOpenHouse = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
    <path d="M8 14h2M14 14h2M8 18h2M14 18h2" />
  </svg>
)

const IconClosing = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="8" width="20" height="13" rx="2" />
    <path d="M2 13h20M8 8V6a4 4 0 0 1 8 0v2" />
    <path d="M9 16l2 2 4-4" />
  </svg>
)

// ── Data ─────────────────────────────────────────────────────────────
const JOURNEY_STAGES = [
  { name: 'Getting ready',            toolCount: 2, num: '01' },
  { name: 'Preparing & comparing',    toolCount: 2, num: '02' },
  { name: 'Following up',             toolCount: 1, num: '03' },
  { name: 'Closing and moving',       toolCount: 1, num: '04' },
]

const TOOLS = [
  {
    name: 'Buyer Readiness Planner',
    url: '/tools/real-estate/buyer',
    stage: 'Getting ready',
    desc: 'A guided questionnaire that helps buyers reflect on their goals, timeline, and priorities before beginning the home search.',
    audience: 'Useful for: buyers at the very start of their journey',
    Icon: IconBuyer,
  },
  {
    name: 'Seller Readiness Planner',
    url: '/tools/real-estate/seller',
    stage: 'Getting ready',
    desc: 'Helps sellers evaluate their readiness — from timeline and motivation to equity awareness and expectations for the sale.',
    audience: 'Useful for: sellers considering whether and when to list',
    Icon: IconSeller,
  },
  {
    name: 'Listing Preparation Action Planner',
    url: '/tools/real-estate/listing-preparation',
    stage: 'Preparing & comparing',
    desc: 'Organizes the work of getting a property ready to list — repairs, staging, and scheduling — into a trackable action plan.',
    audience: 'Useful for: sellers preparing a property for market',
    Icon: IconListing,
  },
  {
    name: 'Home Tour & Property Comparison Planner',
    url: '/tools/real-estate/property-comparison',
    stage: 'Preparing & comparing',
    desc: 'Lets buyers record observations from each tour and compare properties side by side while details are fresh.',
    audience: 'Useful for: active buyers touring multiple properties',
    Icon: IconCompare,
  },
  {
    name: 'Open House Follow-Up Planner',
    url: '/tools/real-estate/open-house-follow-up',
    stage: 'Following up',
    desc: 'Helps agents track open-house visitors, their questions, and which follow-up actions are still outstanding.',
    audience: 'Useful for: listing agents after an open house event',
    Icon: IconOpenHouse,
  },
  {
    name: 'Closing & Moving Organizer',
    url: '/tools/real-estate/closing-moving',
    stage: 'Closing and moving',
    desc: 'Guides buyers, sellers, and relocating households through tasks, contacts, and timeline from contract through the first week in a new home.',
    audience: 'Useful for: anyone coordinating a closing or move',
    Icon: IconClosing,
  },
]

const CUSTOM_OPTIONS = [
  'Agent or brokerage branding — name, logo, contact information, and color palette',
  'Customized question sets, task libraries, and action-item language',
  'Integration into an existing website alongside your other content',
  'Individual tools or the full six-tool suite, depending on your workflow',
  'Lead-delivery or inquiry workflows (requires custom development — not included in the public demos)',
]

// ── Component ─────────────────────────────────────────────────────────
export default function RealEstateToolsShowcasePage() {
  useScrollReveal()

  return (
    <>
      <div className="site-bg" aria-hidden="true">
        <img src={beachBg} alt="" className="site-bg-img" />
        <div className="site-bg-overlay" />
      </div>
      <Nav variant="page" />
      <main>

        {/* ── 1. Hero ─────────────────────────────────────────── */}
        <section className="rts-hero" aria-labelledby="rts-hero-heading">
          <div className="rts-hero-inner">
            <div className="rts-hero-card">
              <p className="rts-hero-new">New from Websites by Leslie</p>
              <p className="section-label">Real Estate Client Tools</p>
              <h1 id="rts-hero-heading" className="rts-hero-headline">
                Interactive planning tools for every stage of the real estate journey
              </h1>
              <p className="rts-hero-suite">
                A complete interactive tool suite for the real-estate client journey.
              </p>
              <p className="rts-hero-sub">
                Six interactive planning tools real estate professionals can share with buyers, sellers,
                and clients — from the first conversation through closing and moving in.
                Each tool supports organized, confident decision-making without offering
                financial, legal, or brokerage advice.
              </p>
              <div className="rts-hero-ctas">
                <a href="#tools" className="btn btn-primary">
                  Explore the tools
                </a>
                <a
                  href={GOOGLE_FORM_URL}
                  className="btn btn-outline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Customize this suite
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Client journey ───────────────────────────────── */}
        <section className="rts-journey" aria-label="Client journey overview">
          <div className="rts-journey-inner" data-reveal>
            <div className="rts-journey-header">
              <p className="section-label">The Client Journey</p>
              <h2 className="section-title">One suite. Every stage.</h2>
              <p className="section-subtitle">
                The six tools map naturally to how a client relationship unfolds — from
                first contact through settled-in.
              </p>
            </div>
            <ol className="rts-journey-stages" aria-label="Journey stages">
              {JOURNEY_STAGES.map((stage) => (
                <li key={stage.name} className="rts-journey-stage">
                  <span className="rts-journey-num" aria-hidden="true">{stage.num}</span>
                  <span className="rts-journey-name">{stage.name}</span>
                  <span className="rts-journey-count">
                    {stage.toolCount === 1 ? '1 tool' : `${stage.toolCount} tools`}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── 3. Six-tool showcase ─────────────────────────────── */}
        <section id="tools" className="rts-showcase" aria-labelledby="rts-showcase-heading">
          <div className="rts-showcase-inner">
            <div className="rts-showcase-header" data-reveal>
              <p className="section-label">The Tools</p>
              <h2 id="rts-showcase-heading" className="section-title">Six tools. One connected suite.</h2>
              <p className="section-subtitle">
                Each tool is a standalone interactive planner. Together, they support
                the full arc of the client relationship.
              </p>
            </div>
            <ul className="rts-tools-grid" role="list">
              {TOOLS.map((tool, i) => {
                const delay = ((i % 3) + 1) as 1 | 2 | 3
                return (
                  <li
                    key={tool.name}
                    className="rts-tool-card"
                    data-reveal="soft"
                    data-reveal-delay={String(delay)}
                  >
                    <div className="rts-tool-icon" aria-hidden="true">
                      <tool.Icon />
                    </div>
                    <span className="rts-tool-stage">{tool.stage}</span>
                    <h3 className="rts-tool-name">{tool.name}</h3>
                    <p className="rts-tool-desc">{tool.desc}</p>
                    <p className="rts-tool-audience">{tool.audience}</p>
                    <a
                      href={tool.url}
                      className="rts-tool-link"
                      aria-label={`Try the ${tool.name} demo`}
                    >
                      Try the demo →
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        {/* ── 4. Customization ─────────────────────────────────── */}
        <section className="rts-custom" aria-labelledby="rts-custom-heading">
          <div className="rts-custom-inner" data-reveal>
            <p className="section-label">For Agents & Brokerages</p>
            <h2 id="rts-custom-heading" className="section-title">Make it yours.</h2>
            <p className="section-subtitle">
              These public demos are available to explore and share. Websites by Leslie can
              adapt the suite for your business — so the tools carry your brand and
              connect directly to how you work with clients.
            </p>
            <p className="section-subtitle rts-custom-note">
              Customization options available upon request include:
            </p>
            <ul className="rts-custom-list">
              {CUSTOM_OPTIONS.map((option) => (
                <li key={option}>{option}</li>
              ))}
            </ul>
            <div className="rts-custom-cta">
              <a
                href={GOOGLE_FORM_URL}
                className="btn btn-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Customize this suite for your business
              </a>
              <a
                href="mailto:websitesbyleslie01@gmail.com"
                className="btn btn-outline"
              >
                Email Me
              </a>
            </div>
          </div>
        </section>

        {/* ── 5. Privacy note ──────────────────────────────────── */}
        <section className="rts-privacy" aria-label="How the tools handle information">
          <div className="rts-privacy-inner" data-reveal>
            <h2 className="rts-privacy-heading">How the demos handle your information</h2>
            <p className="rts-privacy-body">
              The public demos are planning aids, not data-collection tools. Any
              information you enter stays within your current browser session and is
              cleared when you close or navigate away. Nothing is stored, transmitted,
              or retained. These tools are not a substitute for professional financial,
              legal, inspection, or brokerage advice.
            </p>
          </div>
        </section>

        {/* ── 6. Final CTA ─────────────────────────────────────── */}
        <section className="page-cta" aria-label="Get started">
          <div className="page-cta-inner" data-reveal>
            <h2 className="section-title">Ready to build a more connected client experience?</h2>
            <p className="section-subtitle">
              Request a free quote, and I'll take a personal look at how the suite
              could be adapted for your business before we decide on next steps.
            </p>
            <div className="page-cta-buttons">
              <a
                href={GOOGLE_FORM_URL}
                className="btn btn-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Get a Free Quote
              </a>
              <a
                href="mailto:websitesbyleslie01@gmail.com"
                className="btn btn-outline"
              >
                Email Me
              </a>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  )
}
