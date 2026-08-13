import { useState, type ReactNode } from 'react'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import beachBg from '../assets/backgrounds/beach-background.jpeg'
import { useScrollReveal } from '../hooks/useScrollReveal'

const GOOGLE_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSeUMYjVivELKZfTlj-8fQlVmpnxPR6feRorBNSfarpT6oMSRg/viewform?usp=header'

const ChevronIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="faq-chevron"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const faqs: { question: string; answer: ReactNode }[] = [
  {
    question: 'How much does a website cost?',
    answer: (
      <>
        Starting prices are listed on the <a href="/services">Services & Pricing page</a>, but
        every project gets a custom quote based on its goals, content, and needs — there's no
        surprise hourly billing.
      </>
    ),
  },
  {
    question: 'How does payment work?',
    answer:
      "A 50% deposit is due before work begins, and the remaining 50% is due after final approval and before your website launches or is transferred to you. Larger projects may use a custom, written payment schedule.",
  },
  {
    question: 'Do you offer rush projects?',
    answer:
      'Sometimes. If you need a website or update completed on a short timeline, a rush fee may apply to reserve dedicated time. Rush availability depends on my current schedule, and any additional fee will always be included in your written quote before work begins.',
  },
  {
    question: 'How long does a website take?',
    answer:
      "Timing depends on the size of the project and how quickly content, photos, and feedback come together on your end. We'll talk through a clear timeline together before any work begins.",
  },
  {
    question: 'What do you need from me to get started?',
    answer:
      "I'll guide you through it, but it helps to have your business details, services, contact information, photos, your logo or brand materials (if you have them), and a few examples of websites you like.",
  },
  {
    question: "What if I don't have a logo, photos, or all of my wording yet?",
    answer:
      "That's completely okay. We can start with what you have, and I can help you organize your content and figure out practical next steps from there.",
  },
  {
    question: 'Can you update my existing website instead of building a new one?',
    answer:
      "Yes. If your current site has a solid foundation, a refresh can improve clarity, mobile usability, content, and overall polish without starting from scratch.",
  },
  {
    question: 'Do you help with domains and hosting?',
    answer:
      "Yes, depending on the project. I can help with the practical setup — hosting and deployment, connecting your domain, contact forms, and similar basics.",
  },
  {
    question: 'Will my website show up on Google?',
    answer:
      "Every site is built with a clean, mobile-friendly structure and basic SEO setup in mind. That said, I can't make guarantees about search rankings, traffic, or leads — no one honestly can.",
  },
  {
    question: 'What happens after my website launches?',
    answer:
      "You'll have your live website to use and share. If you'd like updates or ongoing support down the road, those are quoted by scope before any work begins.",
  },
  {
    question: 'Can you work with a small budget or barter?',
    answer:
      'Sometimes. Practical options and barter arrangements may be considered case by case, when they make sense for both of us.',
  },
]

export default function FaqPage() {
  useScrollReveal()
  // Independent disclosures, not a single-select accordion — more than
  // one answer can be open at once. Item 0 starts open so the
  // expand/collapse format is obvious without requiring a click first.
  const [openItems, setOpenItems] = useState<Set<number>>(new Set([0]))

  function toggle(index: number) {
    setOpenItems((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

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
              <p className="section-label">FAQ</p>
              <h1 className="section-title">Frequently Asked Questions</h1>
              <p className="section-subtitle">
                Every project is a little different, but these are the questions I hear most
                often — and how working together usually goes.
              </p>
            </div>

            <div className="faq-list">
              {faqs.map((item, i) => {
                const open = openItems.has(i)
                const buttonId = `faq-question-${i}`
                const panelId = `faq-panel-${i}`
                return (
                  <div
                    key={item.question}
                    className="faq-item"
                    data-open={open}
                    data-reveal="soft"
                    data-reveal-delay={(i % 5) + 1}
                  >
                    <h2 className="faq-question-heading">
                      <button
                        type="button"
                        id={buttonId}
                        className="faq-question"
                        aria-expanded={open}
                        aria-controls={panelId}
                        onClick={() => toggle(i)}
                      >
                        <span>{item.question}</span>
                        <ChevronIcon />
                      </button>
                    </h2>
                    <div id={panelId} className="faq-panel-wrap" aria-labelledby={buttonId}>
                      <div className="faq-panel-inner">
                        <p className="faq-answer">{item.answer}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="page-cta">
          <div className="page-cta-inner" data-reveal>
            <h2 className="section-title">Ready to take the next step?</h2>
            <p className="section-subtitle">
              Request a free website review, and I'll take a personal look at your current
              site or idea before we decide on next steps.
            </p>
            <div className="page-cta-buttons">
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
