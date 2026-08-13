import Nav from '../components/Nav'
import Footer from '../components/Footer'
import beachBg from '../assets/backgrounds/beach-background.jpeg'
import { useScrollReveal } from '../hooks/useScrollReveal'

const LESLIE_EMAIL = 'websitesbyleslie01@gmail.com'

export default function PrivacyPolicyPage() {
  useScrollReveal()

  return (
    <>
      <div className="site-bg" aria-hidden="true">
        <img src={beachBg} alt="" className="site-bg-img" />
        <div className="site-bg-overlay" />
      </div>
      <Nav variant="page" />
      <main>
        <section className="privacy">
          <div className="privacy-inner">
            <a href="/" className="page-back">
              ← Back to Websites by Leslie
            </a>

            <div className="privacy-header" data-reveal>
              <p className="section-label">Legal</p>
              <h1 className="section-title">Privacy Policy</h1>
              <p className="privacy-updated">Last updated: August 13, 2026.</p>
              <p className="section-subtitle">
                This page explains what information I collect through this website, how it's
                used, and the choices you have. It's written in plain language for a small,
                independent web design business — it isn't legal advice, and it isn't a claim
                that this site complies with every privacy law that may apply to you.
              </p>
            </div>

            <div className="privacy-body" data-reveal>
              <div className="privacy-section">
                <h2 className="privacy-section-title">Information You May Provide</h2>
                <p className="privacy-section-body">
                  When you use this website or contact me directly, you may choose to share
                  information such as your name, phone number, website address, preferred
                  contact method, and details about your business or project. This can happen
                  through:
                </p>
                <ul className="privacy-list">
                  <li>
                    The Free Website Review form, which opens your own email app with your
                    information pre-filled so that you send it directly to me — this website
                    does not collect or store what you type into that form.
                  </li>
                  <li>
                    A linked Google Form (used for quote requests), which is hosted and stored
                    by Google.
                  </li>
                  <li>Emailing or calling me directly.</li>
                </ul>
              </div>

              <div className="privacy-section">
                <h2 className="privacy-section-title">Cookies & Automatic Information</h2>
                <p className="privacy-section-body">
                  This website does not use cookies, analytics, or tracking scripts to collect
                  information about your visit. If you follow a link to an outside service —
                  like the Google Form mentioned above, or a social media page — that service
                  may collect information under its own privacy policy, separate from this one.
                  This site also loads its typefaces from Google Fonts, which may involve your
                  browser connecting directly to Google's servers to display them.
                </p>
              </div>

              <div className="privacy-section">
                <h2 className="privacy-section-title">How This Information Is Used</h2>
                <p className="privacy-section-body">Information you share is used to:</p>
                <ul className="privacy-list">
                  <li>Reply to your questions and inquiries</li>
                  <li>Provide website reviews, price quotes, and project proposals</li>
                  <li>Communicate with you about an ongoing or potential project</li>
                  <li>Process payment for services, when applicable</li>
                  <li>Improve how I work with clients and run this business</li>
                </ul>
              </div>

              <div className="privacy-section">
                <h2 className="privacy-section-title">Service Providers</h2>
                <p className="privacy-section-body">
                  A few outside services help me run this business. Each has its own privacy
                  practices, separate from mine:
                </p>
                <ul className="privacy-list">
                  <li>
                    <strong>Google Forms</strong> — if you submit a quote request, your
                    responses are collected and stored by Google.
                  </li>
                  <li>
                    <strong>Google Fonts</strong> — this site's typefaces are loaded from
                    Google's font service.
                  </li>
                  <li>
                    <strong>Vercel</strong> — this website is hosted by Vercel Inc., which may
                    automatically log basic technical information (like IP address and browser
                    type) as a standard part of hosting and keeping the site secure.
                  </li>
                  <li>
                    <strong>Payments</strong> — this website does not process payments or store
                    card details directly. If you pay for services, that payment is arranged
                    directly with me through a separate invoicing or payment method, and that
                    provider's own privacy and security practices apply.
                  </li>
                </ul>
              </div>

              <div className="privacy-section">
                <h2 className="privacy-section-title">Sharing Your Information</h2>
                <p className="privacy-section-body">
                  I do not sell your personal information. I share it only when reasonably
                  necessary to provide the services you've requested, process a payment, comply
                  with a legal obligation, or protect my rights, property, or safety, or the
                  rights, property, or safety of others.
                </p>
              </div>

              <div className="privacy-section">
                <h2 className="privacy-section-title">Data Security</h2>
                <p className="privacy-section-body">
                  I take reasonable steps to protect information you share with me, but no
                  method of transmission over the internet or method of electronic storage is
                  completely secure. I can't guarantee absolute security.
                </p>
              </div>

              <div className="privacy-section">
                <h2 className="privacy-section-title">Your Choices</h2>
                <p className="privacy-section-body">
                  You can ask me to access, correct, or delete personal information you've
                  shared with me by emailing{' '}
                  <a href={`mailto:${LESLIE_EMAIL}`}>{LESLIE_EMAIL}</a>. If part of that
                  information was submitted through the Google Form, I may need to help you
                  direct part of that request to Google as well.
                </p>
              </div>

              <div className="privacy-section">
                <h2 className="privacy-section-title">Adults Only</h2>
                <p className="privacy-section-body">
                  This website and my services are intended for adults age 18 or older. I do
                  not knowingly collect personal information from anyone under 18. If you
                  believe someone under 18 has shared personal information with me, please
                  contact me so I can remove it.
                </p>
              </div>

              <div className="privacy-section">
                <h2 className="privacy-section-title">Changes to This Policy</h2>
                <p className="privacy-section-body">
                  I may update this policy from time to time. Any changes will be posted on
                  this page with a revised "Last updated" date.
                </p>
              </div>

              <div className="privacy-section">
                <h2 className="privacy-section-title">Contact</h2>
                <p className="privacy-section-body">
                  Questions about this policy? Email{' '}
                  <a href={`mailto:${LESLIE_EMAIL}`}>{LESLIE_EMAIL}</a> or call{' '}
                  <a href="tel:8505659114">850-565-9114</a>.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
