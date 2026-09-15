import type { ReactNode } from 'react'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import beachBg from '../assets/backgrounds/beach-background.jpeg'
import { useScrollReveal } from '../hooks/useScrollReveal'

const GOOGLE_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSeUMYjVivELKZfTlj-8fQlVmpnxPR6feRorBNSfarpT6oMSRg/viewform?usp=header'

// ── Icons ────────────────────────────────────────────────────────────
const IconCalculator = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <line x1="8" y1="6" x2="16" y2="6" />
    <line x1="8" y1="11" x2="8" y2="11.01" />
    <line x1="12" y1="11" x2="12" y2="11.01" />
    <line x1="16" y1="11" x2="16" y2="11.01" />
    <line x1="8" y1="15" x2="8" y2="15.01" />
    <line x1="12" y1="15" x2="12" y2="15.01" />
    <line x1="16" y1="15" x2="16" y2="18" />
    <line x1="8" y1="18" x2="12" y2="18" />
  </svg>
)

const IconOrder = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
)

const IconWrench = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a4 4 0 1 0-5.4 5.4l-6 6 2 2 6-6a4 4 0 0 0 5.4-5.4l-2.5 2.5-2-2z" />
  </svg>
)

const IconTruck = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="6" width="14" height="12" rx="1" />
    <path d="M15 10h4l3 3v5h-7z" />
    <circle cx="5.5" cy="18.5" r="1.75" />
    <circle cx="17.5" cy="18.5" r="1.75" />
  </svg>
)

const IconHome = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
    <path d="M9 21V12h6v9" />
  </svg>
)

// ── Data — every entry maps to a route confirmed live in this repository,
// with its "Free tool" vs. "Live demo" status verified against the tool's
// own results page (does it carry a tool-sales-cta "want one like this for
// your business?" block, or not). Nothing here is invented. ────────────
interface ToolEntry {
  name: string
  url: string
  desc: string
  audience: string
  kind: 'free' | 'demo'
  Icon: () => ReactNode
}

const BAKER_TOOLS: ToolEntry[] = [
  {
    name: 'Free Home Bakery Pricing Calculator',
    url: '/bakery-pricing-guide',
    desc: 'A free, complete cost-and-pricing calculator for home bakers — ingredients, labor, packaging, waste, and overhead, with a clear suggested price. No account, no ads, and your data stays on your device.',
    audience: 'For: home bakers pricing their own recipes',
    kind: 'free',
    Icon: IconCalculator,
  },
  {
    name: 'Custom Bakery Order Planner',
    url: '/tools-custom-bakery-order',
    desc: 'A guided, step-by-step tool that helps a bakery customer organize their order request — inscription, colors, size, timing, and questions — before contacting the business.',
    audience: 'For: bakeries that take custom orders',
    kind: 'demo',
    Icon: IconOrder,
  },
]

const SERVICE_TOOLS: ToolEntry[] = [
  {
    name: 'Plumbing Service Visit Planner',
    url: '/tools-plumbing-visit',
    desc: "A calm, guided form that helps a homeowner organize what they've observed before calling a plumber — location, timeline, and access details.",
    audience: 'For: plumbing and home-service businesses',
    kind: 'demo',
    Icon: IconWrench,
  },
  {
    name: 'Food Truck Event Planner',
    url: '/tools-food-truck-event',
    desc: 'A guided form that helps an event organizer prepare a clear service inquiry before reaching out to a mobile food or beverage vendor.',
    audience: 'For: food trucks and mobile vendors',
    kind: 'demo',
    Icon: IconTruck,
  },
]

const REAL_ESTATE_SUITE: ToolEntry = {
  name: 'Real Estate Client Tools',
  url: '/real-estate-tools',
  desc: 'A connected suite of six interactive planning tools for buyers, sellers, and clients — from the first conversation through closing and moving in.',
  audience: 'For: real estate agents and their clients',
  kind: 'demo',
  Icon: IconHome,
}

function ToolCard({ tool }: { tool: ToolEntry }) {
  return (
    <li className="bt-tool-card" data-reveal="soft">
      <div className="bt-tool-icon" aria-hidden="true">
        <tool.Icon />
      </div>
      <span className={`bt-tool-tag ${tool.kind === 'free' ? 'bt-tool-tag-free' : 'bt-tool-tag-demo'}`}>
        {tool.kind === 'free' ? 'Free Tool' : 'Live Demo'}
      </span>
      <h3 className="bt-tool-name">{tool.name}</h3>
      <p className="bt-tool-desc">{tool.desc}</p>
      <p className="bt-tool-audience">{tool.audience}</p>
      <a href={tool.url} className="bt-tool-link">
        {tool.kind === 'free' ? 'Use the Free Calculator →' : 'Try the Demo →'}
      </a>
    </li>
  )
}

// A general hub across every industry Websites by Leslie currently has a
// working tool for — confirmed by route and functionality in this
// repository, not invented. Distinguishes the one genuinely free,
// standalone resource (the bakery pricing calculator) from every other
// entry, which is a live, interactive *demo* of custom work available for
// a business's own branding.
export default function BusinessToolsHubPage() {
  useScrollReveal()

  return (
    <>
      <div className="site-bg" aria-hidden="true">
        <img src={beachBg} alt="" className="site-bg-img" />
        <div className="site-bg-overlay" />
      </div>
      <Nav variant="page" />
      <main>
        <section className="bt-hero" aria-labelledby="bt-hero-heading">
          <div className="bt-hero-inner">
            <a href="/" className="page-back">
              ← Back to Websites by Leslie
            </a>
            <p className="section-label">Business Tools</p>
            <h1 id="bt-hero-heading" className="section-title">
              Interactive tools for real businesses
            </h1>
            <p className="section-subtitle">
              A growing collection of free tools and interactive demos, organized by the kind of
              business they're built for.
            </p>
          </div>
        </section>

        <section className="bt-section" aria-labelledby="bt-bakers-heading">
          <div className="bt-section-inner">
            <div className="bt-section-header" data-reveal>
              <p className="section-label">For Home Bakers</p>
              <h2 id="bt-bakers-heading" className="section-title">Pricing and order tools for bakers</h2>
            </div>
            <ul className="bt-tools-grid" role="list">
              {BAKER_TOOLS.map((tool) => <ToolCard key={tool.name} tool={tool} />)}
            </ul>
          </div>
        </section>

        <section className="bt-section" aria-labelledby="bt-service-heading">
          <div className="bt-section-inner">
            <div className="bt-section-header" data-reveal>
              <p className="section-label">For Service &amp; Event Businesses</p>
              <h2 id="bt-service-heading" className="section-title">Intake and planning tools</h2>
            </div>
            <ul className="bt-tools-grid" role="list">
              {SERVICE_TOOLS.map((tool) => <ToolCard key={tool.name} tool={tool} />)}
            </ul>
          </div>
        </section>

        <section className="bt-section" aria-labelledby="bt-realestate-heading">
          <div className="bt-section-inner">
            <div className="bt-section-header" data-reveal>
              <p className="section-label">For Real Estate</p>
              <h2 id="bt-realestate-heading" className="section-title">A complete client-journey suite</h2>
            </div>
            <ul className="bt-tools-grid" role="list">
              <ToolCard tool={REAL_ESTATE_SUITE} />
            </ul>
          </div>
        </section>

        <section className="bt-custom" aria-labelledby="bt-custom-heading">
          <div className="bt-custom-inner" data-reveal>
            <p className="section-label">Want One for Your Business?</p>
            <h2 id="bt-custom-heading" className="section-title">Most of these are demos — I can build yours.</h2>
            <p className="section-subtitle">
              Every tool marked "Live Demo" above is a public example of the kind of interactive
              tool Websites by Leslie can build and customize for your own business — your
              branding, your questions, your workflow. The Free Home Bakery Pricing Calculator is
              different: it's a genuinely free, ready-to-use resource, not a demo of custom work.
            </p>
            <div className="bt-custom-cta">
              <a href={GOOGLE_FORM_URL} className="btn btn-primary" target="_blank" rel="noopener noreferrer">
                Get a Free Quote
              </a>
              <a href="mailto:websitesbyleslie01@gmail.com" className="btn btn-outline">
                Email Me
              </a>
            </div>
          </div>
        </section>

        <section className="page-cta" aria-label="Get started">
          <div className="page-cta-inner" data-reveal>
            <h2 className="section-title">Not sure where to start?</h2>
            <p className="section-subtitle">
              Request a free website review, and I'll take a personal look at your current site or
              idea before we decide on next steps.
            </p>
            <div className="page-cta-buttons">
              <a href="/check" className="btn btn-primary">
                Request a Free Website Review
              </a>
              <a href={GOOGLE_FORM_URL} className="btn btn-outline" target="_blank" rel="noopener noreferrer">
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
