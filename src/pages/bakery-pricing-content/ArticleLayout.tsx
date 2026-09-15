import type { ReactNode } from 'react'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import beachBg from '../../assets/backgrounds/beach-background.jpeg'
import { useScrollReveal } from '../../hooks/useScrollReveal'

export interface RelatedArticle {
  href: string
  title: string
}

interface Props {
  title: string
  intro: string
  children: ReactNode
  related: RelatedArticle[]
}

// Shared layout for the four bakery-pricing educational articles — the
// site's own general content-page shell (site background, Nav, Footer,
// section-label/title/subtitle header, data-reveal scroll-in), not the
// calculator's own scoped bakery-ledger theme. These are marketing/content
// pages that link *into* the tool, not the tool itself.
export function ArticleLayout({ title, intro, children, related }: Props) {
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
            <a href="/bakery-pricing-guide" className="page-back">
              ← Back to the Bakery Pricing Calculator guide
            </a>

            <div className="faq-header" data-reveal>
              <p className="section-label">Bakery Pricing</p>
              <h1 className="section-title">{title}</h1>
              <p className="section-subtitle">{intro}</p>
            </div>

            <article className="bp-article-body" data-reveal="soft">
              {children}
            </article>

            {related.length > 0 && (
              <div className="bp-article-related" data-reveal="soft">
                <p className="bp-article-related-label">More bakery pricing guides</p>
                <ul>
                  {related.map((item) => (
                    <li key={item.href}>
                      <a href={item.href}>{item.title}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        <section className="page-cta">
          <div className="page-cta-inner" data-reveal>
            <h2 className="section-title">Ready to price your own recipe?</h2>
            <p className="section-subtitle">
              The Free Home Bakery Pricing Calculator walks you through your ingredients, labor,
              packaging, waste, and overhead, and gives you a clear suggested price — free, no
              account required, and everything stays on your device.
            </p>
            <div className="page-cta-buttons">
              <a href="/tools-bakery-pricing" className="btn btn-primary">
                Try the Free Bakery Pricing Calculator
              </a>
              <a href="/bakery-pricing-guide" className="btn btn-outline">
                See How It Works
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
