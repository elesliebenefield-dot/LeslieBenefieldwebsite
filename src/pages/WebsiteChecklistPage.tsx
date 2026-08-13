import Nav from '../components/Nav'
import Footer from '../components/Footer'
import beachBg from '../assets/backgrounds/beach-background.jpeg'
import { useScrollReveal } from '../hooks/useScrollReveal'

const GOOGLE_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSeUMYjVivELKZfTlj-8fQlVmpnxPR6feRorBNSfarpT6oMSRg/viewform?usp=header'

const CheckIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const checklistGroups = [
  {
    title: 'Your business basics',
    items: [
      'Business name',
      'A short description of what you do',
      'Services you offer',
      'Service area',
      'Hours',
      'Phone number',
      'Email address',
      'Preferred contact method',
    ],
  },
  {
    title: 'Your goals',
    items: [
      'What you want the website to help with',
      'Who you want to reach',
      'The main action you want visitors to take (call, request a quote, book, order, etc.)',
    ],
  },
  {
    title: 'Your content',
    items: [
      'Existing wording you already have',
      'Service descriptions',
      'Pricing, if you want it shown',
      'FAQs',
      'Testimonials or reviews',
      'Policies',
      'Anything else you already have written',
    ],
  },
  {
    title: 'Your visuals',
    items: [
      'Logo',
      'Brand colors',
      'Photos of you, your team, your work, your location, or your products',
      'Links to your social media',
    ],
    note: 'Professional photos are helpful, but not required.',
  },
  {
    title: 'Your online access',
    items: [
      'Existing domain name',
      'Hosting',
      'Website logins',
      'Google Business Profile',
      'Social accounts',
      'Any other relevant account access',
    ],
    note: "It's okay not to have all of this yet, or not to have access — I can help you sort it out together. Please don't send passwords by email; we'll handle account access safely when it's needed.",
  },
]

export default function WebsiteChecklistPage() {
  useScrollReveal()

  return (
    <>
      <div className="site-bg" aria-hidden="true">
        <img src={beachBg} alt="" className="site-bg-img" />
        <div className="site-bg-overlay" />
      </div>
      <Nav variant="page" />
      <main>
        <section className="checklist">
          <div className="checklist-inner">
            <a href="/" className="page-back">
              ← Back to Websites by Leslie
            </a>

            <div className="checklist-header" data-reveal>
              <p className="section-label">New Client Website Checklist</p>
              <h1 className="section-title">Getting ready for your website</h1>
              <p className="section-subtitle">
                You do not need everything figured out before we talk. This checklist simply
                helps you gather the things that make a website project smoother.
              </p>
            </div>

            <div className="checklist-groups">
              {checklistGroups.map((group, i) => (
                <div
                  key={group.title}
                  className="checklist-group"
                  data-reveal="soft"
                  data-reveal-delay={(i % 5) + 1}
                >
                  <h2 className="checklist-group-title">{group.title}</h2>
                  <ul className="checklist-items">
                    {group.items.map((item) => (
                      <li key={item}>
                        <CheckIcon />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  {group.note && <p className="checklist-note">{group.note}</p>}
                </div>
              ))}
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
