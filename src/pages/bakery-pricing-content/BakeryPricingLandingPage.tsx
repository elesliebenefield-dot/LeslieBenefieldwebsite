import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import beachBg from '../../assets/backgrounds/beach-background.jpeg'
import { useScrollReveal } from '../../hooks/useScrollReveal'

const VALUE_POINTS = [
  'Every cost accounted for — ingredients, labor, packaging, waste, and overhead',
  'A clear per-item and whole-batch suggested price, not just a single number',
  'Optional "Help me estimate this" guidance for labor, overhead, and waste — never a required questionnaire',
  'Save recipes and reusable ingredients, and revisit or adjust them anytime ("what-if" pricing)',
  'Nothing to sign up for — no account, no email address, no ads',
  'Your data stays on your own device and is never transmitted anywhere',
]

// A genuine site page (Nav/Footer, general marketing-page pattern) built
// around the calculator — not the tool itself, which keeps its own
// bakery-ledger identity untouched at /tools-bakery-pricing. Deliberately
// omits any offline/installable claim: that capability (Milestone M8) is
// deferred past initial launch — see plan/prd.md's 2026-09-15 decision note.
export default function BakeryPricingLandingPage() {
  useScrollReveal()

  return (
    <>
      <div className="site-bg" aria-hidden="true">
        <img src={beachBg} alt="" className="site-bg-img" />
        <div className="site-bg-overlay" />
      </div>
      <Nav variant="page" />
      <main>
        <section className="faq">
          <div className="faq-inner">
            <a href="/" className="page-back">
              ← Back to Websites by Leslie
            </a>

            <div className="faq-header" data-reveal>
              <p className="section-label">Free Tool</p>
              <h1 className="section-title">Free Bakery Pricing Calculator</h1>
              <p className="section-subtitle">
                A clear, honest way to find your true recipe cost and a confident selling price — built for
                bakers and bakery businesses tired of guessing.
              </p>
              <div className="page-cta-buttons" data-reveal>
                <a href="/tools-bakery-pricing" className="btn btn-primary">
                  Try the Free Calculator
                </a>
              </div>
            </div>

            <article className="bp-article-body" data-reveal="soft">
              <h2>Why this matters</h2>
              <p>
                This calculator is built for bakers and bakery businesses of every kind — including people
                baking from home, cottage-food businesses, market sellers, and independent bakeries. Most
                home bakers start out pricing by feel — doubling the ingredient cost, or picking a number
                that "feels fair." The trouble is that ingredient cost is only one piece of what a recipe
                really costs. Your time, your packaging, the occasional ruined batch, and the ordinary
                costs of running a small food business all belong in the number too. This calculator walks
                through all of it, in plain language, so your price is based on your real costs instead of a
                guess.
              </p>

              <h2>What it covers</h2>
              <ul>
                {VALUE_POINTS.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>

              <h2>How it works</h2>
              <ol>
                <li>
                  <strong>Recipe &amp; Ingredients</strong> — enter what you're pricing and add each ingredient's
                  package price and the amount your recipe uses.
                </li>
                <li>
                  <strong>Additional Costs</strong> — add labor, supplies &amp; packaging, waste, and overhead —
                  each with a plain direct-entry field, and an optional "Help me estimate this" if you'd like
                  guidance.
                </li>
                <li>
                  <strong>Your Price</strong> — see a full cost breakdown and a suggested whole-batch and
                  per-item price, with a cost-completeness check showing exactly what was and wasn't included.
                </li>
              </ol>
            </article>

            <p className="bp-landing-disclaimer">
              This calculator provides planning estimates only — not financial, accounting, tax, legal, or
              business advice. All calculations happen on your device and are never transmitted anywhere. Built
              by{' '}
              <a href="https://websitesbyleslie.com" target="_blank" rel="noopener noreferrer">
                Websites by Leslie
              </a>
              .
            </p>
          </div>
        </section>

        <section className="page-cta">
          <div className="page-cta-inner" data-reveal>
            <h2 className="section-title">Need a website for your bakery business?</h2>
            <p className="section-subtitle">
              I build affordable websites, online order forms, and custom small-business tools — like this
              calculator — for bakers and bakery businesses.
            </p>
            <div className="page-cta-buttons">
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSeUMYjVivELKZfTlj-8fQlVmpnxPR6feRorBNSfarpT6oMSRg/viewform?usp=header"
                className="btn btn-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Get a Free Quote
              </a>
              <a href="/tools-custom-bakery-order" className="btn btn-outline">
                See the Custom Bakery Order Planner
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
